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

/** example의 evidence가 적은 검색 적중 하나이며 id는 별도 칸으로 온다. */
export interface SnapshotSearchHit {
    readonly id: string;
    readonly [field: string]: unknown;
}

/** 검색 적중 세 벌을 담은 evidence이며 도구마다 자기 칸을 읽는다. */
export interface SnapshotSearchEvidence {
    readonly events: readonly SnapshotSearchHit[];
    readonly tasks: readonly SnapshotSearchHit[];
    readonly recipes: readonly SnapshotSearchHit[];
}

/** 검색이 되돌리는 이벤트 한 건이며 형제 슬라이스의 도구가 요구하는 칸과 같다. */
export interface SnapshotSearchEventView {
    readonly id: string;
    readonly taskId: string;
    readonly seq: string;
    readonly kind: string;
    readonly title: string;
    readonly body?: string;
    readonly toolName?: string;
    readonly filePaths: readonly string[];
    readonly occurredAt: string;
}

/** 검색이 되돌리는 태스크 한 건이다. */
export interface SnapshotSlimTaskView {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly taskKind?: string;
    readonly updatedAt?: string;
}

/** 검색이 되돌리는 레시피 한 건이다. */
export interface SnapshotSlimRecipeView {
    readonly id: string;
    readonly title: string;
    readonly intent: string;
    readonly status: string;
    readonly userEdited: boolean;
    readonly rev?: number;
    readonly updatedAt?: string;
}

/** recipe 검색 도구가 요구하는 표면을 example의 evidence로 되돌리며, 실제 포트 대조는 조립 근원이 한다. */
export class SnapshotRecipeSearch {
    constructor(private readonly evidence: SnapshotSearchEvidence) {}

    searchEvents(
        _userId: string,
        query: { readonly limit: number; readonly offset: number },
    ): Promise<{
        readonly events: readonly SnapshotSearchEventView[];
        readonly truncated: boolean;
        readonly total: number;
    }> {
        const page = this.evidence.events.slice(query.offset, query.offset + query.limit);
        return Promise.resolve({
            events: page.map(toSearchEventView),
            truncated: this.evidence.events.length > query.offset + query.limit,
            total: this.evidence.events.length,
        });
    }

    searchTasks(_userId: string, _q: string, limit: number): Promise<readonly SnapshotSlimTaskView[]> {
        return Promise.resolve(this.evidence.tasks.slice(0, limit).map(toSlimTaskView));
    }

    searchRecipes(_userId: string, _q: string, limit: number): Promise<readonly SnapshotSlimRecipeView[]> {
        return Promise.resolve(this.evidence.recipes.slice(0, limit).map(toSlimRecipeView));
    }
}

function toSearchEventView(hit: SnapshotSearchHit): SnapshotSearchEventView {
    return {
        id: hit.id,
        taskId: text(hit["taskId"]),
        seq: text(hit["seq"]),
        kind: text(hit["kind"]),
        title: text(hit["title"]),
        ...(typeof hit["body"] === "string" ? { body: hit["body"] } : {}),
        ...(typeof hit["toolName"] === "string" ? { toolName: hit["toolName"] } : {}),
        filePaths: Array.isArray(hit["filePaths"]) ? (hit["filePaths"] as readonly string[]) : [],
        occurredAt: text(hit["occurredAt"]),
    };
}

function toSlimTaskView(hit: SnapshotSearchHit): SnapshotSlimTaskView {
    return {
        id: hit.id,
        title: text(hit["title"]),
        status: text(hit["status"]),
        ...(typeof hit["taskKind"] === "string" ? { taskKind: hit["taskKind"] } : {}),
        ...(typeof hit["updatedAt"] === "string" ? { updatedAt: hit["updatedAt"] } : {}),
    };
}

function toSlimRecipeView(hit: SnapshotSearchHit): SnapshotSlimRecipeView {
    return {
        id: hit.id,
        title: text(hit["title"]),
        intent: text(hit["intent"]),
        status: text(hit["status"]),
        userEdited: hit["userEdited"] === true,
        ...(typeof hit["rev"] === "number" ? { rev: hit["rev"] } : {}),
        ...(typeof hit["updatedAt"] === "string" ? { updatedAt: hit["updatedAt"] } : {}),
    };
}

function text(value: unknown): string {
    return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
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
