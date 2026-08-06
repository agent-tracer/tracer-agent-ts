/** 모델 카탈로그와 실행 한도가 이 슬라이스를 부르는 이름이며 계약의 에이전트 이름과 같다. */
export const CLEANUP_FEATURE = "task-cleanup";

/** 이 슬라이스가 실행하는 잡의 종류이며 값은 계약의 잡 어휘가 소유한다. */
export const CLEANUP_JOB_KIND = "task.cleanup";

/** 이 슬라이스가 읽는 설정 항목이며 값은 추적 서비스의 설정 표가 소유한다. */
export const CLEANUP_SETTING_KEY = {
    anthropicApiKey: "anthropic.api_key",
    anthropicModel: "anthropic.model",
    outputLanguage: "claude.outputLanguage",
    maxSuggestions: "taskCleanup.maxSuggestions",
} as const;

/** 이 슬라이스가 내는 유일한 제안 종류이며 값은 산출물 창구의 어휘가 소유한다. */
export const CLEANUP_SUGGESTION_KIND_ARCHIVE = "archive";
