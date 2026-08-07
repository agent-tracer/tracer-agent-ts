import { describe, expect, it } from "vitest";
import { CHAT_EXECUTION_STATUS } from "~agent-api/domain/chat/model/chat.const.js";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import { FixedChatDraftToken } from "~agent-api/domain/chat/port/__fakes__/fixed.chat.draft.token.js";
import { FixedClock } from "~agent-api/domain/chat/port/__fakes__/fixed.clock.js";
import { InMemoryChatExecutionRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { RecordingChatExecutionUpdates } from "~agent-api/domain/chat/port/__fakes__/recording.chat.execution.updates.js";
import { CheckpointChatDraftUseCase } from "./checkpoint.chat.draft.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const CHECKPOINT = { executionId: "e1", token: "draft-token", attempt: 1, draftSeq: 1, text: "부분 답변", phase: "responding" as const };

function runningExecution(): ChatExecution {
    const execution = ChatExecution.create({
        id: "e1",
        userId: "local",
        threadId: "t1",
        replayAnchorMessageId: "m1",
        clientRequestId: "r1",
        inputHash: "h",
        model: null,
        language: null,
        now: NOW,
    });
    execution.status = CHAT_EXECUTION_STATUS.running;
    execution.attempt = 1;
    execution.draftTokenHash = "hash:draft-token";
    return execution;
}

function makeUseCase(): { useCase: CheckpointChatDraftUseCase; updates: RecordingChatExecutionUpdates } {
    const executions = new InMemoryChatExecutionRepository();
    executions.seed(runningExecution());
    const updates = new RecordingChatExecutionUpdates();
    return {
        useCase: new CheckpointChatDraftUseCase(
            executions,
            new FixedChatDraftToken(),
            new FixedClock(NOW),
            updates,
        ),
        updates,
    };
}

describe("CheckpointChatDraftUseCase", () => {
    it("누적 답변을 정본에 반영하고 열린 연결을 깨운다", async () => {
        const { useCase, updates } = makeUseCase();

        await expect(useCase.execute(CHECKPOINT)).resolves.toEqual({ stored: true, terminal: false });
        expect(updates.published).toEqual(["e1"]);
    });

    it("자격이 맞지 않는 통지를 거절한다", async () => {
        const { useCase } = makeUseCase();

        await expect(useCase.execute({ ...CHECKPOINT, token: "다른 토큰" }))
            .rejects.toThrow("Chat draft callback is not authorized");
    });

    it("없는 실행은 존재 자체를 알리지 않는다", async () => {
        const { useCase } = makeUseCase();

        await expect(useCase.execute({ ...CHECKPOINT, executionId: "없음" }))
            .rejects.toThrow("Chat execution not found");
    });

    it("뒤로 가는 판 번호는 반영하지 않는다", async () => {
        const { useCase } = makeUseCase();
        await useCase.execute({ ...CHECKPOINT, draftSeq: 3 });

        await expect(useCase.execute({ ...CHECKPOINT, draftSeq: 2 }))
            .resolves.toEqual({ stored: false, terminal: false });
    });
});
