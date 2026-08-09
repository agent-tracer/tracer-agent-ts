import type { IClock } from "@tracer-agent/platform";
import {
    CLEANUP_SUGGESTION_KIND,
    CLEANUP_SUGGESTION_STATUS,
    type CleanupSuggestionStatus,
} from "~agent-api/domain/cleanup/model/cleanup.const.js";
import { CleanupStaleError } from "~agent-api/domain/cleanup/model/cleanup.errors.js";
import { CleanupSuggestion } from "~agent-api/domain/cleanup/model/cleanup.suggestion.model.js";
import type { CleanupSuggestionRepositoryPort } from "~agent-api/domain/cleanup/port/cleanup.repository.port.js";
import type { CleanupTaskArchiverPort } from "~agent-api/domain/cleanup/port/cleanup.task.archiver.port.js";

/** 저장된 행과 조회 결과를 나누려고 프로토타입을 유지한 채 복제한다. */
function cloneRow<T extends object>(row: T): T {
    return Object.assign(Object.create(Object.getPrototypeOf(row) as object) as T, row);
}

/** 시험이 기준시각을 소유해 시간에 걸린 판정을 결정적으로 검증하게 한다. */
export class FixedClock implements IClock {
    constructor(private readonly current: Date) {}

    now(): Date {
        return this.current;
    }

    nowMs(): number {
        return this.current.getTime();
    }

    nowIso(): string {
        return this.current.toISOString();
    }
}

/** 정리 제안 원장의 대역이며 조회가 사본을 내는 성질만 흉내 내고 대기 행의 유일 색인은 흉내 내지 않는다. */
export class InMemoryCleanupSuggestionRepository implements CleanupSuggestionRepositoryPort {
    private readonly rows = new Map<string, CleanupSuggestion>();

    seed(...suggestions: readonly CleanupSuggestion[]): void {
        for (const suggestion of suggestions) this.rows.set(suggestion.id, suggestion);
    }

    stored(id: string): CleanupSuggestion | null {
        return this.rows.get(id) ?? null;
    }

    findById(id: string): Promise<CleanupSuggestion | null> {
        const row = this.rows.get(id);
        return Promise.resolve(row === undefined ? null : cloneRow(row));
    }

    findByUserStatus(userId: string, status: CleanupSuggestionStatus): Promise<CleanupSuggestion[]> {
        const rows = [...this.rows.values()]
            .filter((row) => row.userId === userId && row.status === status)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
            .map(cloneRow);
        return Promise.resolve(rows);
    }

    upsert(suggestion: CleanupSuggestion): Promise<void> {
        this.rows.set(suggestion.id, suggestion);
        return Promise.resolve();
    }
}

/** 추적의 조건부 보관을 대신하며 계약이 적은 낡음 판정만 재현하고 보관 상태는 들지 않는다. */
export class FakeTaskArchiver implements CleanupTaskArchiverPort {
    readonly calls: {
        readonly userId: string;
        readonly taskId: string;
        readonly ifNoActivitySince: Date | null;
    }[] = [];

    private readonly lastEventAt = new Map<string, Date>();

    seedLastEventAt(taskId: string, at: Date): void {
        this.lastEventAt.set(taskId, at);
    }

    archive(userId: string, taskId: string, ifNoActivitySince: Date | null): Promise<void> {
        this.calls.push({ userId, taskId, ifNoActivitySince });
        const lastEventAt = this.lastEventAt.get(taskId);
        if (lastEventAt === undefined) return Promise.resolve();
        // 조건보다 뒤에 도착한 사건만 새 활동이며 같은 시각은 새 활동이 아니다.
        if (ifNoActivitySince === null || lastEventAt.getTime() > ifNoActivitySince.getTime()) {
            return Promise.reject(new CleanupStaleError());
        }
        return Promise.resolve();
    }
}

/** 케이스가 손대는 칸만 덮어 쓰는 대기 제안 하나다. */
export function suggestionRow(overrides: Partial<CleanupSuggestion> = {}): CleanupSuggestion {
    const suggestion = new CleanupSuggestion();
    suggestion.id = "suggestion-1";
    suggestion.userId = "local";
    suggestion.jobId = "job-1";
    suggestion.taskId = "task-1";
    suggestion.kind = CLEANUP_SUGGESTION_KIND.archive;
    suggestion.currentValue = null;
    suggestion.proposedValue = null;
    suggestion.rationale = "사건이 오래 없다";
    suggestion.status = CLEANUP_SUGGESTION_STATUS.pending;
    suggestion.error = null;
    suggestion.createdAt = new Date("2026-01-01T00:00:00.000Z");
    suggestion.resolvedAt = null;
    suggestion.observedLastEventAt = new Date("2026-01-01T00:01:00.000Z");
    return Object.assign(suggestion, overrides);
}
