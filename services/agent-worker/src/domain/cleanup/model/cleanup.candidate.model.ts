/** 태스크 읽기 모델이 쓰는 running 상태 값이다. */
const RUNNING_TASK_STATUS = "running";
/** 태스크 읽기 모델이 쓰는 waiting 상태 값이다. */
const WAITING_TASK_STATUS = "waiting";

/** 이 시간 안에 활동한 태스크는 정리 후보에서 뺀다. */
export const CLEANUP_RECENT_ACTIVITY_MS = 30 * 60 * 1000;
/** 이 시간 이상 이벤트가 없는 running·waiting 태스크에 stale 신호를 붙인다. */
export const CLEANUP_STALE_MS = 14 * 24 * 60 * 60 * 1000;

export const CLEANUP_CANDIDATE_REASON = {
    noEvents: "no-events",
    stale: "stale",
    duplicateTitle: "duplicate-title",
    placeholderTitle: "placeholder-title",
} as const;

const PLACEHOLDER_TITLE_PATTERN = /^(test|fix\s*bug|todo|wip|session started|정리해줘|테스트|임시)$/iu;

/** 후보 판정이 보는 태스크의 순수 표현이다. */
export interface CleanupTaskSnapshot {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly lastEventAt: string | null;
    readonly updatedAt: string;
}

/** 서버가 결정론적으로 계산한 정리 후보 하나다. */
export interface CleanupCandidate {
    readonly id: string;
    readonly visibleTitle: string;
    readonly status: string;
    readonly lastEventAt: string | null;
    readonly hasEvents: boolean;
    readonly activeChildCount: number;
    readonly candidateReasons: readonly string[];
}

export interface BuildCleanupCandidatesInput {
    readonly tasks: readonly CleanupTaskSnapshot[];
    /** tasks가 상한에 잘려도 판정이 안전하도록 상한 없이 조회한 활성 자식의 부모 ID다. */
    readonly activeChildParentIds: readonly string[];
    readonly now: Date;
}

/** 언어 모델을 부르기 전에 서버가 결정론적으로 정리 후보를 계산한다. */
export function buildCleanupCandidates(input: BuildCleanupCandidatesInput): readonly CleanupCandidate[] {
    const activeChildCounts = countActiveChildren(input.activeChildParentIds);
    const titleCounts = countNormalizedTitles(input.tasks);

    const candidates: CleanupCandidate[] = [];
    for (const task of input.tasks) {
        const activeChildCount = activeChildCounts.get(task.id) ?? 0;
        if (activeChildCount > 0) continue;
        if (isRecentlyActive(task, input.now)) continue;

        const hasEvents = task.lastEventAt !== null;
        const candidateReasons = computeCandidateReasons(task, hasEvents, titleCounts, input.now);
        if (candidateReasons.length === 0) continue;

        candidates.push({
            id: task.id,
            visibleTitle: task.title,
            status: task.status,
            lastEventAt: task.lastEventAt,
            hasEvents,
            activeChildCount,
            candidateReasons,
        });
    }
    return candidates;
}

/** 후보 목록 도구가 내주는 한 페이지다. */
export interface CleanupCandidatePage {
    readonly candidates: readonly CleanupCandidate[];
    readonly truncated: boolean;
    readonly nextCursor?: string;
    readonly total: number;
    readonly moreCandidatesOutsideBatch: boolean;
}

/** 후보 목록을 커서로 잘라 한 페이지를 낸다. */
export function toCleanupCandidatePage(
    candidates: readonly CleanupCandidate[],
    limit: number,
    batchTruncated: boolean,
    cursor?: string,
): CleanupCandidatePage {
    const start = cursor !== undefined ? Number(cursor) : 0;
    const from = Number.isFinite(start) && start > 0 ? start : 0;
    const page = candidates.slice(from, from + limit);
    const nextIndex = from + page.length;
    const truncated = nextIndex < candidates.length;
    return {
        candidates: page,
        truncated,
        ...(truncated ? { nextCursor: String(nextIndex) } : {}),
        total: candidates.length,
        moreCandidatesOutsideBatch: batchTruncated,
    };
}

function countActiveChildren(parentIds: readonly string[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const parentId of parentIds) {
        counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
    }
    return counts;
}

function countNormalizedTitles(tasks: readonly CleanupTaskSnapshot[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const task of tasks) {
        const key = normalizeTitle(task.title);
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
}

function normalizeTitle(title: string): string {
    return title.trim().toLowerCase();
}

function lastActivityMs(task: CleanupTaskSnapshot): number {
    return new Date(task.lastEventAt ?? task.updatedAt).getTime();
}

function isRecentlyActive(task: CleanupTaskSnapshot, now: Date): boolean {
    return now.getTime() - lastActivityMs(task) < CLEANUP_RECENT_ACTIVITY_MS;
}

function computeCandidateReasons(
    task: CleanupTaskSnapshot,
    hasEvents: boolean,
    titleCounts: Map<string, number>,
    now: Date,
): readonly string[] {
    const reasons: string[] = [];
    if (!hasEvents) reasons.push(CLEANUP_CANDIDATE_REASON.noEvents);
    if ((titleCounts.get(normalizeTitle(task.title)) ?? 0) > 1) reasons.push(CLEANUP_CANDIDATE_REASON.duplicateTitle);
    if (PLACEHOLDER_TITLE_PATTERN.test(task.title.trim())) reasons.push(CLEANUP_CANDIDATE_REASON.placeholderTitle);

    const isActiveStatus = task.status === RUNNING_TASK_STATUS || task.status === WAITING_TASK_STATUS;
    if (isActiveStatus && now.getTime() - lastActivityMs(task) >= CLEANUP_STALE_MS) {
        reasons.push(CLEANUP_CANDIDATE_REASON.stale);
    }
    return reasons;
}
