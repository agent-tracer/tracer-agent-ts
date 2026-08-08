import { AGENT_BACKEND } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import type { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import { ChatThread } from "~agent-api/domain/chat/model/chat.thread.model.js";
import { FixedClock } from "~agent-api/domain/chat/port/__fakes__/fixed.clock.js";
import { InMemoryChatExecutionRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.execution.repository.js";
import { InMemoryChatMessageRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.message.repository.js";
import { InMemoryChatPendingToolRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.pending.tool.repository.js";
import { InMemoryChatThreadRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.thread.repository.js";
import { inMemoryChatTransaction } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.transaction.js";
import { RecordingChatExecutionDispatcher } from "~agent-api/domain/chat/port/__fakes__/recording.chat.execution.dispatcher.js";
import { SequentialChatIdGenerator } from "~agent-api/domain/chat/port/__fakes__/sequential.chat.id.generator.js";
import { EnqueueChatTurnUseCase } from "./enqueue.chat.turn.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const TURN = { userId: "local", threadId: "t1", clientRequestId: "r1", content: "안녕" };

/** 접수가 멱등 조회를 지난 뒤 다른 replica 가 같은 행을 먼저 적고 간 경쟁을 만든다. */
class RacingChatExecutionRepository extends InMemoryChatExecutionRepository {
    private hideOnce = false;

    hideNextIdempotencyRead(): void {
        this.hideOnce = true;
    }

    override findByIdempotency(
        userId: string,
        threadId: string,
        clientRequestId: string,
    ): Promise<ChatExecution | null> {
        if (!this.hideOnce) return super.findByIdempotency(userId, threadId, clientRequestId);
        this.hideOnce = false;
        return Promise.resolve(null);
    }
}

function makeUseCase(): {
    useCase: EnqueueChatTurnUseCase;
    executions: RacingChatExecutionRepository;
    dispatcher: RecordingChatExecutionDispatcher;
} {
    const threads = new InMemoryChatThreadRepository();
    threads.seed(ChatThread.create({ id: "t1", userId: "local", title: "첫 대화", now: NOW }));
    const executions = new RacingChatExecutionRepository();
    const messages = new InMemoryChatMessageRepository();
    const dispatcher = new RecordingChatExecutionDispatcher();
    const transaction = inMemoryChatTransaction({
        executions,
        messages,
        pendingTools: new InMemoryChatPendingToolRepository(),
        threads,
    });
    return {
        useCase: new EnqueueChatTurnUseCase(
            transaction,
            executions,
            messages,
            dispatcher,
            new FixedClock(NOW),
            new SequentialChatIdGenerator(),
        ),
        executions,
        dispatcher,
    };
}

describe("EnqueueChatTurnUseCase", () => {
    it("사용자 메시지와 실행 행을 함께 적고 워크플로를 깨운다", async () => {
        const { useCase, dispatcher } = makeUseCase();

        const { message, execution } = await useCase.execute(TURN);

        expect(message.content).toBe("안녕");
        expect(execution.status).toBe("queued");
        expect(dispatcher.started).toEqual([{ executionId: execution.id, threadId: "t1" }]);
    });

    it("접수한 실행에 자기 축을 적는다", async () => {
        const { useCase } = makeUseCase();

        const { execution } = await useCase.execute(TURN);

        expect(execution.requestedBackend).toBe(AGENT_BACKEND);
    });

    it("같은 요청 식별자와 같은 입력이면 접수를 하나로 접는다", async () => {
        const { useCase, executions, dispatcher } = makeUseCase();

        const first = await useCase.execute(TURN);
        const second = await useCase.execute(TURN);

        expect(second.execution.id).toBe(first.execution.id);
        expect(await executions.listByThread("t1")).toHaveLength(1);
        expect(dispatcher.started).toHaveLength(2);
    });

    it("같은 요청 식별자로 다른 입력이 오면 거절한다", async () => {
        const { useCase } = makeUseCase();
        await useCase.execute(TURN);

        await expect(useCase.execute({ ...TURN, content: "다른 말" }))
            .rejects.toMatchObject({ code: "chat.execution-idempotency-conflict" });
    });

    it("진행 중인 턴이 있으면 새 턴을 거절한다", async () => {
        const { useCase } = makeUseCase();
        await useCase.execute(TURN);

        await expect(useCase.execute({ ...TURN, clientRequestId: "r2", content: "이어서" }))
            .rejects.toMatchObject({ code: "chat.execution-active-conflict" });
    });

    it("원장이 중복으로 거절한 접수는 이미 적힌 실행으로 답한다", async () => {
        const { useCase, executions } = makeUseCase();
        const first = await useCase.execute(TURN);
        await executions.cancelActive(first.execution.id, NOW);
        executions.hideNextIdempotencyRead();

        const second = await useCase.execute(TURN);

        expect(second.execution.id).toBe(first.execution.id);
        expect(await executions.listByThread("t1")).toHaveLength(1);
    });

    it("원장이 중복으로 거절했는데 그 행을 되읽지 못하면 거절한다", async () => {
        const { useCase, executions } = makeUseCase();
        const first = await useCase.execute(TURN);
        await executions.cancelActive(first.execution.id, NOW);
        executions.hideNextIdempotencyRead();

        await expect(useCase.execute({ ...TURN, content: "다른 말" }))
            .rejects.toMatchObject({ code: "chat.execution-idempotency-conflict" });
    });

    it("소유하지 않은 스레드에는 접수하지 않는다", async () => {
        const { useCase } = makeUseCase();

        await expect(useCase.execute({ ...TURN, userId: "other" })).rejects.toThrow("Thread not found");
    });
});
