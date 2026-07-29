export const EVALUATION_EXECUTION_READER = Symbol("EvaluationExecutionReader");
import type {
    ChatExecutionStepView,
    ChatExecutionView,
    ChatMessageView,
    JobExecutionStepView,
    JobExecutionView,
} from "../model/execution.source.view.model.js";
export type {
    ChatExecutionStepView,
    ChatExecutionView,
    ChatMessageView,
    JobExecutionStepView,
    JobExecutionView,
} from "../model/execution.source.view.model.js";

/** 평가 사례 후보에 필요한 실행 원장의 읽기 표면이다. */
export interface EvaluationExecutionReaderPort {
    findJobById(id: string): Promise<JobExecutionView | null>;
    findJobSteps(jobId: string, userId: string): Promise<JobExecutionStepView[]>;
    findChatExecutionById(id: string): Promise<ChatExecutionView | null>;
    findChatExecutionSteps(id: string, userId: string): Promise<ChatExecutionStepView[]>;
    findChatMessageById(id: string): Promise<ChatMessageView | null>;
}
