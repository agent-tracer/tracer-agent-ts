import { AGENT_BACKEND } from "@tracer-agent/llm";
import { In, LessThan, type QueryDeepPartialEntity, type Repository } from "typeorm";
import { CHAT_EXECUTION_STATUS } from "~agent-api/domain/chat/model/chat.const.js";
import type { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import type { ChatExecutionRepositoryPort } from "~agent-api/domain/chat/port/chat.repository.port.js";
import { ChatExecutionEntity, toChatExecution, toChatExecutionRow } from "./chat.execution.entity.js";

export class TypeOrmChatExecutionRepository implements ChatExecutionRepositoryPort {
    constructor(private readonly repo: Repository<ChatExecutionEntity>) {}

    async findById(id: string): Promise<ChatExecution | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row === null ? null : toChatExecution(row);
    }

    async findByIdempotency(
        userId: string,
        threadId: string,
        clientRequestId: string,
    ): Promise<ChatExecution | null> {
        const row = await this.repo.findOne({ where: { userId, threadId, clientRequestId } });
        return row === null ? null : toChatExecution(row);
    }

    async findLatestActiveByThread(threadId: string): Promise<ChatExecution | null> {
        const row = await this.repo.findOne({
            where: {
                threadId,
                status: In([CHAT_EXECUTION_STATUS.queued, CHAT_EXECUTION_STATUS.running]),
            },
            order: { createdAt: "DESC" },
        });
        return row === null ? null : toChatExecution(row);
    }

    async listActive(): Promise<ChatExecution[]> {
        const rows = await this.repo.find({
            where: {
                status: In([CHAT_EXECUTION_STATUS.queued, CHAT_EXECUTION_STATUS.running]),
                requestedBackend: AGENT_BACKEND,
            },
            order: { createdAt: "ASC", id: "ASC" },
        });
        return rows.map(toChatExecution);
    }

    async listByThread(threadId: string, limit?: number): Promise<ChatExecution[]> {
        const rows = await this.repo.find({
            where: { threadId },
            order: { createdAt: "DESC" },
            ...(limit !== undefined ? { take: limit } : {}),
        });
        return rows.map(toChatExecution);
    }

    // 살아 있는 실행은 시도를 열고 draft를 적으며 행을 건드리므로 갱신 시각이 곧 임차 갱신이다.
    async recoverStaleRunning(idleBefore: Date, now: Date, threadId?: string): Promise<number> {
        const result = await this.repo.update(
            {
                status: CHAT_EXECUTION_STATUS.running,
                requestedBackend: AGENT_BACKEND,
                updatedAt: LessThan(idleBefore),
                ...(threadId !== undefined ? { threadId } : {}),
            },
            { status: CHAT_EXECUTION_STATUS.queued, startedAt: null, updatedAt: now },
        );
        return result.affected ?? 0;
    }

    async checkpointRunning(
        id: string,
        attempt: number,
        draftText: string,
        draftSeq: number,
        now: Date,
    ): Promise<boolean> {
        const result = await this.repo.update(
            { id, status: CHAT_EXECUTION_STATUS.running, attempt, draftSeq: LessThan(draftSeq) },
            { draftText, draftSeq, updatedAt: now },
        );
        return result.affected === 1;
    }

    async cancelActive(id: string, now: Date): Promise<boolean> {
        const result = await this.repo.createQueryBuilder().update(ChatExecutionEntity)
            .set({ status: CHAT_EXECUTION_STATUS.canceled, completedAt: now, updatedAt: now })
            .where("id = :id", { id })
            // running 행은 관측이 취소를 새겼거나 그 실행의 관측이 하나도 없을 때 닫는다.
            .andWhere(`(status = :queued OR (status = :running AND (EXISTS (
                SELECT 1 FROM agent_run_observations observation
                 WHERE observation.execution_id = chat_executions.id
                   AND observation.user_id = chat_executions.user_id
                   AND observation.status = 'cancelled'
            ) OR NOT EXISTS (
                SELECT 1 FROM agent_run_observations observation
                 WHERE observation.execution_id = chat_executions.id
            ))))`, { queued: CHAT_EXECUTION_STATUS.queued, running: CHAT_EXECUTION_STATUS.running })
            .execute();
        return result.affected === 1;
    }

    async insert(execution: ChatExecution): Promise<void> {
        const row = toChatExecutionRow(execution) as unknown as QueryDeepPartialEntity<ChatExecutionEntity>;
        await this.repo.insert(row);
    }

    async deleteByThread(threadId: string): Promise<void> {
        await this.repo.delete({ threadId });
    }
}
