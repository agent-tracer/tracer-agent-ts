import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ChatExecutionStep } from "~agent-api/domain/chat/model/chat.execution.step.model.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    CHAT_EXECUTION_STEP_REPOSITORY,
    type ChatExecutionRepositoryPort,
    type ChatExecutionStepRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";

/** 궤적 한 줄의 와이어 표현이며 값이 없는 자리는 싣지 않는다. */
export type ChatExecutionStepDto = Omit<
    ChatExecutionStep,
    "id" | "executionId" | "userId" | "createdAt" | "toolCalls"
> & { readonly toolCalls: readonly unknown[] };

/** 어느 도구가 얼마나 걸렸는지 사후에 답할 수 있도록 턴 하나의 궤적을 순서대로 돌려준다. */
@Injectable()
export class GetChatExecutionStepsUseCase {
    constructor(
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_EXECUTION_STEP_REPOSITORY) private readonly steps: ChatExecutionStepRepositoryPort,
    ) {}

    async execute(
        userId: string,
        threadId: string,
        executionId: string,
    ): Promise<{ readonly items: readonly ChatExecutionStepDto[] }> {
        const execution = await this.executions.findById(executionId);
        // 남의 스레드에 걸린 실행은 존재 자체를 알리지 않는다.
        if (execution === null || execution.userId !== userId || execution.threadId !== threadId) {
            throw new NotFoundException("Chat execution not found");
        }
        return { items: (await this.steps.findByExecutionId(executionId, userId)).map(mapChatStep) };
    }
}

function mapChatStep(step: ChatExecutionStep): ChatExecutionStepDto {
    return {
        seq: step.seq,
        attempt: step.attempt,
        role: step.role,
        content: step.content,
        truncated: step.truncated,
        toolCalls: step.toolCalls ?? [],
        ...(step.toolName !== null ? { toolName: step.toolName } : {}),
        ...(step.toolCallId !== null ? { toolCallId: step.toolCallId } : {}),
        ...(step.inputTokens !== null ? { inputTokens: step.inputTokens } : {}),
        ...(step.outputTokens !== null ? { outputTokens: step.outputTokens } : {}),
        ...(step.cacheReadTokens !== null ? { cacheReadTokens: step.cacheReadTokens } : {}),
        ...(step.cacheCreationTokens !== null ? { cacheCreationTokens: step.cacheCreationTokens } : {}),
        ...(step.stopReason !== null ? { stopReason: step.stopReason } : {}),
        ...(step.nodeName !== null ? { nodeName: step.nodeName } : {}),
        ...(step.eventKind !== null ? { eventKind: step.eventKind } : {}),
        ...(step.durationMs !== null ? { durationMs: step.durationMs } : {}),
    } as ChatExecutionStepDto;
}
