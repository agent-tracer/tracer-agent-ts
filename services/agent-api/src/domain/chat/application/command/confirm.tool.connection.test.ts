import path from "node:path";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ChatExecutionEntity } from "~agent-api/domain/chat/adapter/chat.execution.entity.js";
import { ChatMessageEntity } from "~agent-api/domain/chat/adapter/chat.message.entity.js";
import { ChatPendingToolEntity } from "~agent-api/domain/chat/adapter/chat.pending.tool.entity.js";
import { ChatThreadEntity } from "~agent-api/domain/chat/adapter/chat.thread.entity.js";
import { TypeOrmChatExecutionRepository } from "~agent-api/domain/chat/adapter/typeorm.chat.execution.repository.adapter.js";
import { TypeOrmChatMessageRepository } from "~agent-api/domain/chat/adapter/typeorm.chat.message.repository.adapter.js";
import { TypeOrmChatPendingToolRepository } from "~agent-api/domain/chat/adapter/typeorm.chat.pending.tool.repository.adapter.js";
import { TypeOrmChatThreadRepository } from "~agent-api/domain/chat/adapter/typeorm.chat.thread.repository.adapter.js";
import { ChatPendingTool } from "~agent-api/domain/chat/model/chat.pending.tool.model.js";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { FixedClock } from "~agent-api/domain/chat/port/__fakes__/fixed.clock.js";
import { RecordingChatExecutionDispatcher } from "~agent-api/domain/chat/port/__fakes__/recording.chat.execution.dispatcher.js";
import { RecordingChatExecutionUpdates } from "~agent-api/domain/chat/port/__fakes__/recording.chat.execution.updates.js";
import { SequentialChatIdGenerator } from "~agent-api/domain/chat/port/__fakes__/sequential.chat.id.generator.js";
import { CONTRACT_ROOT } from "~agent-api/support/contract.js";
import { ConfirmToolUseCase } from "./confirm.tool.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");
// 계약이 agent 상류로 매는 도구는 자기 API 를 다시 부르므로 같은 풀에서 연결을 하나 더 요구한다.
const UPSTREAM_TOOL = "remember_fact";

let ledger: StartedLedger;

beforeAll(async () => {
    ledger = await startLedger(
        path.join(CONTRACT_ROOT, "db", "migrations"),
        [ChatThreadEntity, ChatMessageEntity, ChatPendingToolEntity, ChatExecutionEntity],
        { size: 1, acquireTimeoutMs: 700 },
    );
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
});

/** 승인된 도구가 자기 API 를 부르는 것을 흉내 내며 그 창구가 요구하는 연결을 실제로 빌린다. */
function upstreamExecutor(): Record<string, () => Promise<string>> {
    return {
        [UPSTREAM_TOOL]: async () => {
            await ledger.source.query("SELECT 1");
            return "Remembered.";
        },
    };
}

async function seed(): Promise<ConfirmToolUseCase> {
    const threads = new TypeOrmChatThreadRepository(ledger.repository(ChatThreadEntity));
    const messages = new TypeOrmChatMessageRepository(ledger.repository(ChatMessageEntity));
    const pendingTools = new TypeOrmChatPendingToolRepository(ledger.repository(ChatPendingToolEntity));
    const executions = new TypeOrmChatExecutionRepository(ledger.repository(ChatExecutionEntity));

    await threads.create(ChatThread.create({ id: "t1", userId: "local", title: "첫 대화", now: NOW }));
    await pendingTools.create(ChatPendingTool.create({
        id: "c1",
        threadId: "t1",
        messageId: null,
        toolName: UPSTREAM_TOOL,
        args: { key: "tone", value: "짧게" },
        now: NOW,
    }));

    return new ConfirmToolUseCase(
        threads,
        messages,
        pendingTools,
        upstreamExecutor(),
        new FixedClock(NOW),
        new SequentialChatIdGenerator(),
        executions,
        new RecordingChatExecutionUpdates(),
        new RecordingChatExecutionDispatcher(),
    );
}

describe("승인 해소가 쥐는 원장 연결", () => {
    it("자기 API 를 부르는 도구를 풀 상한 하나에서도 끝까지 실행한다", async () => {
        const useCase = await seed();

        const result = await useCase.execute({
            userId: "local", threadId: "t1", confirmationId: "c1", decision: "approve",
        });

        expect(result).toMatchObject({ status: "approved", result: "Remembered." });
    });

    it("거절도 같은 상한에서 해소한다", async () => {
        const useCase = await seed();

        const result = await useCase.execute({
            userId: "local", threadId: "t1", confirmationId: "c1", decision: "reject",
        });

        expect(result.status).toBe("rejected");
    });
});
