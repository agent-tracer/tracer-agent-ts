import {
    ActivityCancellationType,
    CancellationScope,
    isCancellation,
    proxyActivities,
    sleep,
} from "@temporalio/workflow";
import type {
    GeneratedChatExecution,
    PreparedChatExecution,
} from "~agent-worker/domain/chat/model/chat.execution.stage.js";
import {
    CHAT_GENERATE_MAX_ATTEMPTS,
    CHAT_THREAD_BUSY_FAILURE,
    CHAT_THREAD_BUSY_MAX_ROUNDS,
    CHAT_THREAD_BUSY_RETRY_MS,
    type ChatExecutionWorkflowInput,
    type FailChatExecutionInput,
} from "~agent-worker/domain/chat/model/chat.workflow.spec.js";
import { messageOf } from "~agent-worker/support/failure.message.js";

interface ChatExecutionActivities {
    prepareChatExecution(input: ChatExecutionWorkflowInput): Promise<PreparedChatExecution>;
    generateChatExecution(input: PreparedChatExecution): Promise<GeneratedChatExecution>;
    finalizeChatExecution(input: GeneratedChatExecution): Promise<void>;
    failChatExecution(input: FailChatExecutionInput): Promise<void>;
}

const { prepareChatExecution, finalizeChatExecution } = proxyActivities<ChatExecutionActivities>({
    startToCloseTimeout: "2 minutes",
    retry: { maximumAttempts: 5 },
});

const { generateChatExecution } = proxyActivities<ChatExecutionActivities>({
    startToCloseTimeout: "15 minutes",
    heartbeatTimeout: "30 seconds",
    // 기본값 TRY_CANCEL은 취소 즉시 실패로 접어 그때까지 쓴 답변을 버리므로 최종 상태를 기다린다.
    cancellationType: ActivityCancellationType.WAIT_CANCELLATION_COMPLETED,
    retry: { maximumAttempts: CHAT_GENERATE_MAX_ATTEMPTS },
});

const { failChatExecution } = proxyActivities<ChatExecutionActivities>({
    startToCloseTimeout: "1 minute",
    retry: { maximumAttempts: 5 },
});

/** 브라우저와 API 연결 밖에서 대화 실행 하나를 소유하고 실패 상태를 끝까지 기록한다. */
export async function chatExecutionWorkflow(input: ChatExecutionWorkflowInput): Promise<void> {
    try {
        const prepared = await prepareUntilThreadFrees(input);
        const generated = await generateChatExecution(prepared);
        // 취소가 이미 걸린 뒤에도 종결은 실행돼야 사용자가 화면에서 본 답변이 남는다.
        await CancellationScope.nonCancellable(() => finalizeChatExecution(generated));
    } catch (error) {
        if (isCancellation(error)) throw error;
        await failChatExecution({ executionId: input.executionId, error: messageOf(error) });
        throw error;
    }
}

/** 스레드가 잠긴 동안 이 실행은 queued로 살아 있으므로 자리가 나기를 기다렸다가 다시 가져간다. */
async function prepareUntilThreadFrees(
    input: ChatExecutionWorkflowInput,
): Promise<PreparedChatExecution> {
    for (let round = 1; ; round += 1) {
        try {
            return await prepareChatExecution(input);
        } catch (error) {
            if (round >= CHAT_THREAD_BUSY_MAX_ROUNDS || !isThreadBusy(error)) throw error;
            await sleep(CHAT_THREAD_BUSY_RETRY_MS);
        }
    }
}

function isThreadBusy(error: unknown): boolean {
    for (let cause: unknown = error; cause instanceof Error; cause = cause.cause) {
        if ((cause as { readonly type?: unknown }).type === CHAT_THREAD_BUSY_FAILURE) return true;
    }
    return false;
}
