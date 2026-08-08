import {
    CancellationScope,
    condition,
    continueAsNew,
    defineSignal,
    isCancellation,
    proxyActivities,
    setHandler,
    startChild,
} from "@temporalio/workflow";
import {
    CHAT_ACTIVITY_LIMITS,
    CHAT_THREAD_IDLE_TIMEOUT,
    CHAT_THREAD_MAX_CHILDREN,
    type ChatThreadWorkflowInput,
} from "~agent-worker/domain/chat/model/chat.workflow.spec.js";

/** 스레드 워크플로가 자식을 띄울 때 쓰는 이름과 신호이며 접수가 같은 값으로 신호를 보낸다. */
const CHAT_EXECUTION_WORKFLOW = "chatExecutionWorkflow";
const CHAT_EXECUTION_ENQUEUE_SIGNAL = "enqueueChatExecution";

interface ChatQueueActivities {
    getNextChatExecution(threadId: string): Promise<string | null>;
}

const { getNextChatExecution } = proxyActivities<ChatQueueActivities>({
    startToCloseTimeout: CHAT_ACTIVITY_LIMITS.getNextChatExecution.startToClose,
    retry: { maximumAttempts: CHAT_ACTIVITY_LIMITS.getNextChatExecution.maximumAttempts },
});

const enqueueExecution = defineSignal<[string]>(CHAT_EXECUTION_ENQUEUE_SIGNAL);

/** 스레드 안의 자식 실행을 순서대로 하나씩 기다려 모델 호출이 겹치지 않게 한다. */
export async function chatThreadWorkflow(input: ChatThreadWorkflowInput): Promise<void> {
    let wake = false;
    let startedChildren = 0;
    setHandler(enqueueExecution, () => {
        wake = true;
    });
    for (;;) {
        const signaled = await condition(() => wake, CHAT_THREAD_IDLE_TIMEOUT);
        if (!signaled) return;
        wake = false;
        let lastFailed: string | null = null;
        for (;;) {
            const executionId = await getNextChatExecution(input.threadId);
            if (executionId === null) break;
            // 같은 실행이 연달아 실패하면 큐에 그대로 남아 무한히 다시 선택되므로 이번 회차를 줄인다.
            if (executionId === lastFailed) break;
            try {
                const child = await startChild(CHAT_EXECUTION_WORKFLOW, {
                    workflowId: executionWorkflowId(executionId),
                    workflowIdReusePolicy: "REJECT_DUPLICATE",
                    args: [{ executionId }],
                });
                startedChildren += 1;
                await child.result();
                lastFailed = null;
            } catch (error) {
                // 스레드 자신이 취소된 것만 스레드를 끝내고 실행 하나의 취소는 남은 큐를 계속 비운다.
                if (isCancellation(error) && CancellationScope.current().consideredCancelled) throw error;
                lastFailed = executionId;
            }
            // 자식은 실패해도 이력에 남으므로 띄운 수로 접어야 실패가 이어질 때도 이력이 접힌다.
            if (startedChildren >= CHAT_THREAD_MAX_CHILDREN) {
                await continueAsNew<typeof chatThreadWorkflow>(input);
            }
        }
    }
}

function executionWorkflowId(executionId: string): string {
    return `chat:${executionId}`;
}
