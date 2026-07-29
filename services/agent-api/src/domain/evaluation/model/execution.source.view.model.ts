export interface JobExecutionView {
    readonly id: string;
    readonly userId: string;
    readonly kind: string;
    readonly status: string;
    readonly input: Record<string, unknown>;
    readonly result: Record<string, unknown>;
}

export interface JobExecutionStepView {
    readonly role: string;
    readonly toolName: string | null;
    readonly content: string;
    readonly truncated: boolean;
}

export interface ChatExecutionView {
    readonly id: string;
    readonly userId: string;
    readonly status: string;
    readonly userMessageId: string;
    readonly assistantMessageId: string | null;
}

export interface ChatMessageView {
    readonly id: string;
    readonly content: string;
}

export type ChatExecutionStepView = JobExecutionStepView;
