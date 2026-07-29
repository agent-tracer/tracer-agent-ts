import type { SnapshotEvent, SnapshotRule, SnapshotTask } from "~agent-worker/domain/evaluation/model/evaluation.snapshot.model.js";

/** title·recipe 두 슬라이스가 각자 선언한 태스크·이벤트 조회 표면을 example의 evidence 스냅샷 하나로 함께 구현하며, 형제 슬라이스의 포트 타입은 조립 근원에서만 대조된다. */
export class SnapshotTaskAndEventReader {
    private readonly ascending: readonly SnapshotEvent[];

    constructor(private readonly task: SnapshotTask, events: readonly SnapshotEvent[]) {
        this.ascending = [...events].sort((left, right) => compareSeq(left.seq, right.seq));
    }

    findById(): Promise<SnapshotTask | null> {
        return Promise.resolve(this.task);
    }

    taskExists(): Promise<boolean> {
        return Promise.resolve(true);
    }

    readTimeline(query: { readonly limit: number; readonly descending: boolean; readonly cursor?: string }): Promise<
        readonly (Omit<SnapshotEvent, "occurredAt" | "metadata"> & { readonly occurredAt: string })[]
    > {
        const ordered = query.descending ? [...this.ascending].reverse() : this.ascending;
        const from = query.cursor === undefined
            ? 0
            : ordered.findIndex((event) => (query.descending ? compareSeq(event.seq, query.cursor!) < 0 : compareSeq(event.seq, query.cursor!) > 0));
        const start = from < 0 ? ordered.length : from;
        return Promise.resolve(ordered.slice(start, start + query.limit).map(toStringTimestamp));
    }

    findTimeline(
        _userId: string,
        _taskId: string,
        cursor: { readonly seq: string } | undefined,
        limit: number,
    ): Promise<readonly SnapshotEvent[]> {
        const from = cursor === undefined ? 0 : this.ascending.findIndex((event) => compareSeq(event.seq, cursor.seq) > 0);
        const start = from < 0 ? this.ascending.length : from;
        return Promise.resolve(this.ascending.slice(start, start + limit));
    }

    findTimelineWindow(_userId: string, _taskId: string, cursor: string | undefined, limit: number): Promise<readonly SnapshotEvent[]> {
        const descending = [...this.ascending].reverse();
        const from = cursor === undefined ? 0 : descending.findIndex((event) => compareSeq(event.seq, cursor) < 0);
        const start = from < 0 ? descending.length : from;
        return Promise.resolve(descending.slice(start, start + limit));
    }

    countByTask(): Promise<number> {
        return Promise.resolve(this.ascending.length);
    }
}

/** 규칙 조회 표면을 example의 evidence 규칙 목록으로 구현한다. */
export class SnapshotRuleReader {
    constructor(private readonly rules: readonly SnapshotRule[]) {}

    findApplicable(): Promise<readonly SnapshotRule[]> {
        return Promise.resolve([...this.rules]);
    }
}

/** OpenSearch가 낼 응답의 hit 하나이며, id는 별도 필드로 온다. */
export interface SnapshotSearchHit {
    readonly id: string;
    readonly [field: string]: unknown;
}

/** recipe 검색 도구가 요구하는 검색 표면을 각 도구별 evidence 배열로 되돌린다. */
export class SnapshotRecipeSearchClient {
    constructor(private readonly byIndex: Readonly<Record<string, readonly SnapshotSearchHit[]>>) {}

    search(request: { readonly index: string; readonly body: Record<string, unknown> }): Promise<unknown> {
        const hits = this.byIndex[request.index] ?? [];
        return Promise.resolve({
            hits: {
                total: { value: hits.length },
                hits: hits.map((hit) => ({ _id: hit.id, _source: withoutId(hit) })),
            },
        });
    }
}

function withoutId(hit: SnapshotSearchHit): Record<string, unknown> {
    const { id: _id, ...rest } = hit;
    return rest;
}

function toStringTimestamp(event: SnapshotEvent): Omit<SnapshotEvent, "occurredAt" | "metadata"> & { readonly occurredAt: string } {
    const { metadata: _metadata, ...rest } = event;
    return { ...rest, occurredAt: event.occurredAt.toISOString() };
}

// seq는 bigint를 문자열로 실어 나르므로 사전식이 아니라 자릿수를 맞춰 비교한다.
function compareSeq(left: string, right: string): number {
    if (left.length !== right.length) return left.length - right.length;
    return left < right ? -1 : left > right ? 1 : 0;
}
