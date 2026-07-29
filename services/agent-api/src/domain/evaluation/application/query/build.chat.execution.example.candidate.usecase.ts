import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    buildChatCandidate,
    type ExecutionExampleCandidate,
} from "~agent-api/domain/evaluation/model/execution.example.candidate.model.js";
import {
    EVALUATION_EXECUTION_READER,
    type EvaluationExecutionReaderPort,
} from "~agent-api/domain/evaluation/port/execution.reader.port.js";

@Injectable()
export class BuildChatExecutionExampleCandidateUseCase {
    constructor(
        @Inject(EVALUATION_EXECUTION_READER) private readonly executions: EvaluationExecutionReaderPort,
    ) {}

    async execute(userId: string, executionId: string): Promise<ExecutionExampleCandidate> {
        const execution = await this.executions.findChatExecutionById(executionId);
        if (execution === null || execution.userId !== userId) {
            throw new NotFoundException("Chat execution not found");
        }
        if (execution.status !== "completed" || execution.assistantMessageId === null) {
            throw new ConflictException("Chat execution is not completed");
        }
        const [userMessage, assistantMessage, steps] = await Promise.all([
            this.executions.findChatMessageById(execution.userMessageId),
            this.executions.findChatMessageById(execution.assistantMessageId),
            this.executions.findChatExecutionSteps(execution.id, userId),
        ]);
        if (userMessage === null || assistantMessage === null) {
            throw new ConflictException("Chat execution messages are incomplete");
        }
        return buildChatCandidate(execution, userMessage, assistantMessage, steps);
    }
}
