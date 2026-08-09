export const CLEANUP_SUGGESTION_KIND = {
    archive: "archive",
} as const;

export const CLEANUP_SUGGESTION_KINDS = [CLEANUP_SUGGESTION_KIND.archive] as const;

export type CleanupSuggestionKind = (typeof CLEANUP_SUGGESTION_KINDS)[number];

export const CLEANUP_SUGGESTION_STATUS = {
    pending: "pending",
    accepted: "accepted",
    dismissed: "dismissed",
} as const;

/** 정리 제안 상태 어휘의 정본이며 조회 스키마와 상태 없는 목록의 이어 붙이는 순서가 이 순서를 쓴다. */
export const CLEANUP_SUGGESTION_STATUSES = [
    CLEANUP_SUGGESTION_STATUS.pending,
    CLEANUP_SUGGESTION_STATUS.accepted,
    CLEANUP_SUGGESTION_STATUS.dismissed,
] as const;

export type CleanupSuggestionStatus = (typeof CLEANUP_SUGGESTION_STATUSES)[number];
