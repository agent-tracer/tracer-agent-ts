import type { DataSource } from "typeorm";
import type {
    ChatExecutionStepView,
    ChatExecutionView,
    ChatMessageView,
    JobExecutionStepView,
    JobExecutionView,
} from "../model/execution.source.view.model.js";
import type { EvaluationExecutionReaderPort } from "../port/execution.reader.port.js";

/** 실행 원장을 평가 사례 후보용 읽기 뷰로 좁힌다. */
export class EvaluationExecutionReaderAdapter implements EvaluationExecutionReaderPort {
    constructor(private readonly source: DataSource) {}

    async findJobById(id: string): Promise<JobExecutionView | null> {
        const rows: JobExecutionView[] = await this.source.query(
            `SELECT id, user_id AS "userId", kind, status, input, result FROM ai_jobs WHERE id = $1`,
            [id],
        );
        return rows[0] ?? null;
    }

    findJobSteps(jobId: string, userId: string): Promise<JobExecutionStepView[]> {
        return this.source.query(
            `SELECT role, tool_name AS "toolName", content, truncated
             FROM ai_job_steps WHERE job_id = $1 AND user_id = $2 ORDER BY seq ASC`,
            [jobId, userId],
        );
    }

    async findChatExecutionById(id: string): Promise<ChatExecutionView | null> {
        const rows: ChatExecutionView[] = await this.source.query(
            `SELECT id, user_id AS "userId", status, user_message_id AS "userMessageId",
                    assistant_message_id AS "assistantMessageId"
             FROM chat_executions WHERE id = $1`,
            [id],
        );
        return rows[0] ?? null;
    }

    findChatExecutionSteps(id: string, userId: string): Promise<ChatExecutionStepView[]> {
        return this.source.query(
            `SELECT role, tool_name AS "toolName", content, truncated
             FROM chat_execution_steps WHERE execution_id = $1 AND user_id = $2 ORDER BY seq ASC`,
            [id, userId],
        );
    }

    async findChatMessageById(id: string): Promise<ChatMessageView | null> {
        const rows: ChatMessageView[] = await this.source.query(
            `SELECT id, content FROM chat_messages WHERE id = $1`,
            [id],
        );
        return rows[0] ?? null;
    }
}
