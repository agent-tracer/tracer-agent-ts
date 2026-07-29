/** 관측 이름이 파생되는 에이전트의 경계 식별자이며 값은 계약의 에이전트 이름이 소유한다. */
export const AGENT = {
    chat: { id: "chat" },
    recipeScan: { id: "recipe-scan", jobKind: "recipe.scan" },
    taskCleanup: { id: "task-cleanup", jobKind: "task.cleanup" },
    titleSuggestion: { id: "title-suggestion", jobKind: "title.suggestion" },
} as const;

export type AgentId = (typeof AGENT)[keyof typeof AGENT]["id"];

/** 사용자 범위를 밝히는 요청 헤더이며 실행 범위 자격이 있으면 서버가 자격의 값을 우선한다. */
export const MONITOR_USER_HEADER = "x-monitor-user";

/** 모델 키를 담은 설정 항목의 이름이며 scope는 사용자 식별자다. */
export const ANTHROPIC_API_KEY_SETTING = "anthropic.api_key";
