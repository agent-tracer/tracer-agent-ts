import { AGENT_BACKEND, AGENT_RUN_OBSERVATION_STATUS } from "@tracer-agent/llm";
import { LessThan, type QueryDeepPartialEntity, type Repository } from "typeorm";
import {
    CHAT_EXECUTION_CLAIM,
    CHAT_EXECUTION_PHASE,
    CHAT_EXECUTION_STATUS,
    type ChatExecutionClaim,
    type ChatExecutionPhase,
} from "~agent-worker/domain/chat/model/chat.const.js";
import type {
    ChatExecution,
    ChatExecutionSpend,
} from "~agent-worker/domain/chat/model/chat.execution.model.js";
import type { ChatExecutionRepositoryPort } from "~agent-worker/domain/chat/port/chat.repository.port.js";
import { ChatExecutionEntity, toChatExecution } from "./chat.entity.js";

export class TypeOrmChatExecutionRepository implements ChatExecutionRepositoryPort {
    constructor(private readonly repo: Repository<ChatExecutionEntity>) {}

    async findById(id: string): Promise<ChatExecution | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row === null ? null : toChatExecution(row);
    }

    async listQueuedByThread(threadId: string): Promise<ChatExecution[]> {
        const rows = await this.repo.find({
            where: { threadId, status: CHAT_EXECUTION_STATUS.queued, requestedBackend: AGENT_BACKEND },
            order: { createdAt: "ASC", id: "ASC" },
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

    async claimQueued(id: string, now: Date): Promise<ChatExecutionClaim> {
        let result;
        try {
            result = await this.repo.update(
                { id, status: CHAT_EXECUTION_STATUS.queued },
                { status: CHAT_EXECUTION_STATUS.running, startedAt: now, updatedAt: now },
            );
        } catch (error) {
            // 스레드가 잠긴 것은 이 실행의 결함이 아니므로 예외가 아니라 결과로 돌려준다.
            if (!isUniqueViolation(error)) throw error;
            return CHAT_EXECUTION_CLAIM.threadBusy;
        }
        return result.affected === 1 ? CHAT_EXECUTION_CLAIM.claimed : CHAT_EXECUTION_CLAIM.stale;
    }

    async beginAttempt(id: string, attempt: number, now: Date): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({
                attempt,
                // 시도가 올라도 살아 있던 실행은 처음 받은 자격을 그대로 들고 있으므로 창구를 닫지 않는다.
                draftText: "",
                draftSeq: 0,
                updatedAt: now,
            })
            .where("id = :id AND status = :status AND attempt <= :attempt")
            .setParameters({ id, status: CHAT_EXECUTION_STATUS.running, attempt })
            .execute();
        return result.affected === 1;
    }

    async checkpointRunning(
        id: string,
        attempt: number,
        draftText: string,
        draftSeq: number,
        phase: ChatExecutionPhase,
        now: Date,
    ): Promise<boolean> {
        const result = await this.repo.update(
            { id, status: CHAT_EXECUTION_STATUS.running, attempt, draftSeq: LessThan(draftSeq) },
            { draftText, draftSeq, phase, updatedAt: now },
        );
        return result.affected === 1;
    }

    async completeRunning(
        id: string,
        assistantMessageId: string,
        spend: ChatExecutionSpend,
        now: Date,
    ): Promise<boolean> {
        const result = await this.repo.update(
            { id, status: CHAT_EXECUTION_STATUS.running },
            spendPatch(assistantMessageId, spend, now, {
                status: CHAT_EXECUTION_STATUS.completed,
                phase: CHAT_EXECUTION_PHASE.done,
                completedAt: now,
            }),
        );
        return result.affected === 1;
    }

    // 취소는 취소로 남아야 하므로 상태와 종료 시각은 두고 아직 비어 있는 산출물 자리에만 한 번 쓴다.
    async recordCanceledOutcome(
        id: string,
        assistantMessageId: string,
        spend: ChatExecutionSpend,
        now: Date,
    ): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .update(ChatExecutionEntity)
            .set(spendPatch(assistantMessageId, spend, now, { phase: CHAT_EXECUTION_PHASE.done }))
            .where("id = :id", { id })
            .andWhere("assistant_message_id IS NULL")
            .andWhere(observedTerminalCondition(AGENT_RUN_OBSERVATION_STATUS.cancelled), {
                settled: CHAT_EXECUTION_STATUS.canceled,
                running: CHAT_EXECUTION_STATUS.running,
            })
            .execute();
        return result.affected === 1;
    }

    async failActive(id: string, error: string, now: Date): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .update(ChatExecutionEntity)
            .set({
                status: CHAT_EXECUTION_STATUS.failed,
                phase: CHAT_EXECUTION_PHASE.done,
                error,
                completedAt: now,
                updatedAt: now,
            })
            .where("id = :id", { id })
            .andWhere(failableCondition("failed"), {
                notStarted: CHAT_EXECUTION_STATUS.queued,
                running: CHAT_EXECUTION_STATUS.running,
            })
            .execute();
        return result.affected === 1;
    }
}

/** running 행은 관측이 같은 종결을 기록했을 때 접으며 이미 접힌 행에 산출물을 붙이는 길이 이것을 쓴다. */
function observedTerminalCondition(observedStatus: string): string {
    return `(status = :settled OR (status = :running AND ${observedBy(observedStatus)}))`;
}

/** 실패로 옮길 수 있는 행이며 아직 시작하지 않았거나, 실행 중이면서 같은 관측이 있거나 따를 관측이 하나도 없는 행이다. */
function failableCondition(observedStatus: string): string {
    return `(status = :notStarted OR (status = :running AND (${observedBy(observedStatus)} OR NOT EXISTS (
        SELECT 1 FROM agent_run_observations observation
         WHERE observation.execution_id = chat_executions.id
    ))))`;
}

function observedBy(observedStatus: string): string {
    return `EXISTS (
        SELECT 1 FROM agent_run_observations observation
         WHERE observation.execution_id = chat_executions.id
           AND observation.user_id = chat_executions.user_id
           AND observation.status = '${observedStatus}'
    )`;
}

function spendPatch(
    assistantMessageId: string,
    spend: ChatExecutionSpend,
    now: Date,
    extra: Record<string, unknown>,
): QueryDeepPartialEntity<ChatExecutionEntity> {
    return {
        assistantMessageId,
        modelUsed: spend.modelUsed,
        costUsd: spend.costUsd,
        numTurns: spend.numTurns,
        stopReason: spend.stopReason,
        usage: spend.usage,
        updatedAt: now,
        ...extra,
    } as unknown as QueryDeepPartialEntity<ChatExecutionEntity>;
}

// 겉 오류와 드라이버 오류 어느 쪽에 실려도 유일 제약 위반으로 본다.
function isUniqueViolation(error: unknown): boolean {
    if (errorCode(error) === "23505") return true;
    return errorCode((error as { readonly driverError?: unknown } | null)?.driverError) === "23505";
}

function errorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) return undefined;
    const code = (error as { readonly code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
}
