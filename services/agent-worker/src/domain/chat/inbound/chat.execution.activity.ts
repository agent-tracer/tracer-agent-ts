import { ApplicationFailure, Context } from "@temporalio/activity";
import {
    AgentExecutionFailure,
    PROVIDER_ERROR_SUBTYPE,
    guardActivity,
    isNonRetryableSubtype,
} from "@tracer-agent/llm";
import type { FailChatExecutionUsecase } from "~agent-worker/domain/chat/application/fail.chat.execution.usecase.js";
import type { FinalizeChatExecutionUsecase } from "~agent-worker/domain/chat/application/finalize.chat.execution.usecase.js";
import type { GenerateChatExecutionUsecase } from "~agent-worker/domain/chat/application/generate.chat.execution.usecase.js";
import type { GetNextChatExecutionUsecase } from "~agent-worker/domain/chat/application/get.next.chat.execution.usecase.js";
import type { PrepareChatExecutionUsecase } from "~agent-worker/domain/chat/application/prepare.chat.execution.usecase.js";
import {
    ChatExecutionNotFoundError,
    ChatMissingApiKeyError,
    ChatThreadBusyError,
} from "~agent-worker/domain/chat/model/chat.errors.js";
import type {
    GeneratedChatExecution,
    PreparedChatExecution,
} from "~agent-worker/domain/chat/model/chat.execution.stage.js";
import {
    CHAT_THREAD_BUSY_FAILURE,
    type ChatExecutionWorkflowInput,
    type FailChatExecutionInput,
} from "~agent-worker/domain/chat/model/chat.workflow.spec.js";

const HEARTBEAT_MS = 10_000;

/** 대화가 자기 재시도 표를 갖지 않도록 고유 실패를 계약이 이미 판정해 둔 서브타입으로 옮긴다. */
function chatErrorSubtype(error: Error): string | null {
    if (error instanceof AgentExecutionFailure) return error.errorSubtype;
    // 설정에 키가 없는 실행은 같은 봉투로 다시 실행해도 키가 생기지 않는다.
    if (error instanceof ChatMissingApiKeyError) return PROVIDER_ERROR_SUBTYPE.authentication;
    if (error instanceof ChatExecutionNotFoundError) return PROVIDER_ERROR_SUBTYPE.notFound;
    return null;
}

function isNonRetryableChatError(error: Error): boolean {
    return isNonRetryableSubtype(chatErrorSubtype(error));
}

/** 활동 호출을 대화 실행 유스케이스에 잇고 취소 신호를 모델 호출까지 전파한다. */
export class ChatExecutionActivity {
    constructor(
        private readonly prepareExecution: PrepareChatExecutionUsecase,
        private readonly generateExecution: GenerateChatExecutionUsecase,
        private readonly finalizeExecution: FinalizeChatExecutionUsecase,
        private readonly failExecution: FailChatExecutionUsecase,
        private readonly getNextExecution: GetNextChatExecutionUsecase,
    ) {}

    prepareChatExecution = async (input: ChatExecutionWorkflowInput): Promise<PreparedChatExecution> =>
        this.guard("prepareChatExecution", input.executionId, async () => {
            try {
                return await this.prepareExecution.execute(input.executionId);
            } catch (error) {
                // 잠긴 스레드는 활동을 몇 초 안에 다시 실행해 풀리지 않으므로 기다림은 워크플로가 소유한다.
                if (!(error instanceof ChatThreadBusyError)) throw error;
                throw ApplicationFailure.create({
                    message: error.message,
                    type: CHAT_THREAD_BUSY_FAILURE,
                    nonRetryable: true,
                });
            }
        });

    generateChatExecution = async (prepared: PreparedChatExecution): Promise<GeneratedChatExecution> => {
        const context = Context.current();
        const heartbeat = setInterval(() => Context.current().heartbeat(), HEARTBEAT_MS);
        try {
            return await this.guard("generateChatExecution", prepared.executionId, () =>
                this.generateExecution.execute(prepared, context.cancellationSignal, context.info.attempt),
            );
        } finally {
            clearInterval(heartbeat);
        }
    };

    finalizeChatExecution = (generated: GeneratedChatExecution): Promise<void> =>
        this.guard("finalizeChatExecution", generated.executionId, () =>
            this.finalizeExecution.execute(generated),
        );

    failChatExecution = (input: FailChatExecutionInput): Promise<void> =>
        this.guard("failChatExecution", input.executionId, () =>
            this.failExecution.execute(input.executionId, input.error),
        );

    getNextChatExecution = (threadId: string): Promise<string | null> =>
        this.guard("getNextChatExecution", threadId, () => this.getNextExecution.execute(threadId));

    private guard<T>(activity: string, jobId: string, run: () => Promise<T>): Promise<T> {
        return guardActivity({ activity, jobId, isNonRetryable: isNonRetryableChatError }, run);
    }
}
