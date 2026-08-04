/** 모델 카탈로그와 실행 한도가 이 슬라이스를 부르는 이름이다. */
export const CHAT_FEATURE = "chat";

export const CHAT_MESSAGE_ROLE = {
    user: "user",
    assistant: "assistant",
    tool: "tool",
} as const;

export const CHAT_MESSAGE_ROLES = [
    CHAT_MESSAGE_ROLE.user,
    CHAT_MESSAGE_ROLE.assistant,
    CHAT_MESSAGE_ROLE.tool,
] as const;

export type ChatMessageRole = (typeof CHAT_MESSAGE_ROLES)[number];

export const CHAT_PENDING_TOOL_STATUS = {
    pending: "pending",
    approved: "approved",
    rejected: "rejected",
} as const;

export const CHAT_PENDING_TOOL_STATUSES = [
    CHAT_PENDING_TOOL_STATUS.pending,
    CHAT_PENDING_TOOL_STATUS.approved,
    CHAT_PENDING_TOOL_STATUS.rejected,
] as const;

export type ChatPendingToolStatus = (typeof CHAT_PENDING_TOOL_STATUSES)[number];

export const CHAT_EXECUTION_STATUS = {
    queued: "queued",
    running: "running",
    completed: "completed",
    failed: "failed",
    canceled: "canceled",
} as const;

export const CHAT_EXECUTION_STATUSES = [
    CHAT_EXECUTION_STATUS.queued,
    CHAT_EXECUTION_STATUS.running,
    CHAT_EXECUTION_STATUS.completed,
    CHAT_EXECUTION_STATUS.failed,
    CHAT_EXECUTION_STATUS.canceled,
] as const;

export type ChatExecutionStatus = (typeof CHAT_EXECUTION_STATUSES)[number];

/** 모델이 응답을 멈춘 이유이며, 실행 수명을 나타내는 status와 다른 축이다. */
export const CHAT_STOP_REASON = {
    completed: "completed",
    deadline: "deadline",
    stalled: "stalled",
    budgetLanded: "budget_landed",
    turnLimit: "turn_limit",
    canceled: "canceled",
    failed: "failed",
} as const;

export const CHAT_STOP_REASONS = [
    CHAT_STOP_REASON.completed,
    CHAT_STOP_REASON.deadline,
    CHAT_STOP_REASON.stalled,
    CHAT_STOP_REASON.budgetLanded,
    CHAT_STOP_REASON.turnLimit,
    CHAT_STOP_REASON.canceled,
    CHAT_STOP_REASON.failed,
] as const;

export type ChatStopReason = (typeof CHAT_STOP_REASONS)[number];

/** 실행 백엔드가 시스템 프롬프트에 렌더링하는 언어 지시문 키이며, 접수의 입력 검증도 같은 값을 쓴다. */
export const CHAT_LANGUAGE = {
    auto: "auto",
    ko: "ko",
    en: "en",
    ja: "ja",
    zh: "zh",
} as const;
