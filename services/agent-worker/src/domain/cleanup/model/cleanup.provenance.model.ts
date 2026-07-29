import type { CleanupCandidate } from "./cleanup.candidate.model.js";
import type { CleanupSlimEvent } from "./cleanup.event.model.js";

export interface CleanupProvenanceSnapshot {
    readonly candidatesById: Readonly<Record<string, CleanupCandidate>>;
    /** get_task_events로 실제로 열어본 태스크만 키를 가지며 이벤트가 하나도 없으면 빈 배열이다. */
    readonly eventIdsByTask: Readonly<Record<string, readonly string[]>>;
}

/** 최종 제안이 인용할 수 있는 실행 내 도구 관측만 모은다. */
export class CleanupProvenanceLedger {
    private readonly candidatesById = new Map<string, CleanupCandidate>();
    private readonly eventIdsByTask = new Map<string, Set<string>>();

    recordCandidates(candidates: readonly CleanupCandidate[]): void {
        for (const candidate of candidates) this.candidatesById.set(candidate.id, candidate);
    }

    /** 도구를 부른 사실 자체가 조사의 증거이므로 이벤트가 없어도 태스크를 장부에 올린다. */
    recordInspection(taskId: string, events: readonly CleanupSlimEvent[]): void {
        const ids = this.eventIdsByTask.get(taskId) ?? new Set<string>();
        for (const event of events) ids.add(event.id);
        this.eventIdsByTask.set(taskId, ids);
    }

    /** 조율자와 후보별 조사의 장부를 하나로 합칠 때, 다른 장부가 모은 것을 이 장부로 흡수한다. */
    mergeFrom(other: CleanupProvenanceLedger): void {
        const seen = other.snapshot();
        for (const candidate of Object.values(seen.candidatesById)) this.candidatesById.set(candidate.id, candidate);
        for (const [taskId, ids] of Object.entries(seen.eventIdsByTask)) {
            const set = this.eventIdsByTask.get(taskId) ?? new Set<string>();
            for (const id of ids) set.add(id);
            this.eventIdsByTask.set(taskId, set);
        }
    }

    snapshot(): CleanupProvenanceSnapshot {
        return {
            candidatesById: Object.fromEntries(this.candidatesById),
            eventIdsByTask: Object.fromEntries(
                [...this.eventIdsByTask.entries()].map(([taskId, ids]) => [taskId, [...ids]] as const),
            ),
        };
    }
}

export function exposedCandidate(
    snapshot: CleanupProvenanceSnapshot,
    taskId: string,
): CleanupCandidate | undefined {
    return snapshot.candidatesById[taskId];
}

export function isTaskInspected(snapshot: CleanupProvenanceSnapshot, taskId: string): boolean {
    return snapshot.eventIdsByTask[taskId] !== undefined;
}

export function inspectedEventIds(
    snapshot: CleanupProvenanceSnapshot,
    taskId: string,
): readonly string[] {
    return snapshot.eventIdsByTask[taskId] ?? [];
}
