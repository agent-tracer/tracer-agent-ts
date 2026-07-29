import type {
    ChatExecutionStepView,
    ChatExecutionView,
    ChatMessageView,
    EvaluationExecutionReaderPort,
    JobExecutionStepView,
    JobExecutionView,
} from "../execution.reader.port.js";

export class InMemoryEvaluationExecutionReader implements EvaluationExecutionReaderPort {
    readonly jobs = new Map<string, JobExecutionView>();
    readonly jobSteps = new Map<string, JobExecutionStepView[]>();
    readonly chatExecutions = new Map<string, ChatExecutionView>();
    readonly chatSteps = new Map<string, ChatExecutionStepView[]>();
    readonly chatMessages = new Map<string, ChatMessageView>();

    findJobById(id: string): Promise<JobExecutionView | null> {
        return Promise.resolve(this.jobs.get(id) ?? null);
    }

    findJobSteps(jobId: string): Promise<JobExecutionStepView[]> {
        return Promise.resolve([...(this.jobSteps.get(jobId) ?? [])]);
    }

    findChatExecutionById(id: string): Promise<ChatExecutionView | null> {
        return Promise.resolve(this.chatExecutions.get(id) ?? null);
    }

    findChatExecutionSteps(id: string): Promise<ChatExecutionStepView[]> {
        return Promise.resolve([...(this.chatSteps.get(id) ?? [])]);
    }

    findChatMessageById(id: string): Promise<ChatMessageView | null> {
        return Promise.resolve(this.chatMessages.get(id) ?? null);
    }
}
