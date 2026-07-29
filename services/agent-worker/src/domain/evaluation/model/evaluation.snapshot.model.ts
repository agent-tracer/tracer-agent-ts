/** evaluation_examples.evidence 안에서 하나의 도구가 돌려주는 이벤트 목록의 원소 모양이며, title·recipe 두 슬라이스의 slim event 표현과 필드가 같다. */
export interface EvidenceEvent {
    readonly id: string;
    readonly seq: string;
    readonly kind: string;
    readonly title: string;
    readonly body?: string;
    readonly toolName?: string;
    readonly filePaths?: readonly string[];
    readonly occurredAt: string;
    readonly turnId?: string;
}

/** evidence의 예약 키("task")에 올 수 있는, 소유권 확인과 요약 도구가 보는 태스크의 최소 표현이다. */
export interface EvidenceTask {
    readonly id?: string;
    readonly title?: string;
    readonly status?: string;
    readonly taskKind?: string;
    readonly workspacePath?: string | null;
    readonly createdAt?: string;
    readonly updatedAt?: string;
}

export type SnapshotRuleExpectation =
    | { readonly kind: "command"; readonly commandMatches: readonly string[] }
    | { readonly kind: "pattern"; readonly pattern: string; readonly tool?: string }
    | { readonly kind: "action"; readonly tool: string };

/** evidence 안에서 list_rules가 돌려주는 규칙 목록의 원소 모양이다. */
export interface EvidenceRule {
    readonly id: string;
    readonly name: string;
    readonly expectation: SnapshotRuleExpectation;
    readonly taskId: string;
    readonly anchorEventId: string;
    readonly source: string;
    readonly severity: string;
    readonly rationale?: string | null;
    readonly signature: string;
    readonly createdAt?: string;
}

/** 도구가 근거로 읽는, 하나의 스냅샷 이벤트다. */
export interface SnapshotEvent {
    readonly id: string;
    readonly seq: string;
    readonly turnId: string | null;
    readonly kind: string;
    readonly title: string;
    readonly body: string | null;
    readonly toolName: string | null;
    readonly filePaths: readonly string[];
    readonly metadata: Record<string, unknown>;
    readonly occurredAt: Date;
}

/** 도구가 소유권 확인과 요약으로 읽는, 하나의 스냅샷 태스크다. */
export interface SnapshotTask {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly taskKind: string;
    readonly workspacePath: string | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

/** 도구가 적용 가능한 근거로 읽는, 하나의 스냅샷 규칙이다. */
export interface SnapshotRule {
    readonly id: string;
    readonly name: string;
    readonly expectation: SnapshotRuleExpectation;
    readonly taskId: string;
    readonly anchorEventId: string;
    readonly source: string;
    readonly severity: string;
    readonly rationale: string | null;
    readonly signature: string;
    readonly createdAt: Date;
}

/** evidence[key]가 배열이면 그대로, 아니면(데이터가 없어도 도구 루프를 막지 않도록) 빈 배열로 읽는다. */
export function readEvidenceArray<T>(evidence: Record<string, unknown>, key: string): readonly T[] {
    const value = evidence[key];
    return Array.isArray(value) ? (value as readonly T[]) : [];
}

/** evidence[key]가 평범한 객체면 그대로, 아니면 null로 읽는다. */
export function readEvidenceObject<T>(evidence: Record<string, unknown>, key: string): T | null {
    const value = evidence[key];
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as T) : null;
}

/** evidence의 도구 응답 하나를 이벤트 조회 도구가 돌려줘야 할 스냅샷 이벤트로 되돌린다. */
export function toSnapshotEvent(event: EvidenceEvent): SnapshotEvent {
    return {
        id: event.id,
        seq: event.seq,
        turnId: event.turnId ?? null,
        kind: event.kind,
        title: event.title,
        body: event.body ?? null,
        toolName: event.toolName ?? null,
        filePaths: event.filePaths ?? [],
        metadata: {},
        occurredAt: new Date(event.occurredAt),
    };
}

/** evidence["task"](있으면)와 example.input의 taskId로 소유권 확인 도구가 돌려줄 최소 스냅샷 태스크를 만든다. */
export function toSnapshotTask(taskId: string, evidence?: EvidenceTask | null): SnapshotTask {
    const now = new Date();
    return {
        id: evidence?.id ?? taskId,
        title: evidence?.title ?? "",
        workspacePath: evidence?.workspacePath ?? null,
        status: evidence?.status ?? "running",
        taskKind: evidence?.taskKind ?? "primary",
        createdAt: evidence?.createdAt !== undefined ? new Date(evidence.createdAt) : now,
        updatedAt: evidence?.updatedAt !== undefined ? new Date(evidence.updatedAt) : now,
    };
}

/** evidence의 list_rules 응답을 규칙 조회 도구가 돌려줘야 할 스냅샷 규칙으로 되돌린다. */
export function toSnapshotRule(rule: EvidenceRule): SnapshotRule {
    return {
        id: rule.id,
        name: rule.name,
        expectation: rule.expectation,
        taskId: rule.taskId,
        anchorEventId: rule.anchorEventId,
        source: rule.source,
        severity: rule.severity,
        rationale: rule.rationale ?? null,
        signature: rule.signature,
        createdAt: rule.createdAt !== undefined ? new Date(rule.createdAt) : new Date(),
    };
}
