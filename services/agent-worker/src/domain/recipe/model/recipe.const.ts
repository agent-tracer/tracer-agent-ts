/** 모델 카탈로그와 실행 한도가 이 슬라이스를 부르는 이름이며 계약의 에이전트 이름과 같다. */
export const RECIPE_FEATURE = "recipe-scan";

/** 이 슬라이스가 실행하는 잡의 종류이며 값은 계약의 잡 어휘가 소유한다. */
export const RECIPE_JOB_KIND = "recipe.scan";

/** 한 태스크가 서로 다른 작업 턴을 담을 수 있어 스캔 한 번이 낼 수 있는 후보 수다. */
export const RECIPE_CANDIDATE_LIMIT = 4;

/** 스캔을 요청한 표면이며 앵커 자격 판정이 여기서 갈린다. */
export const RECIPE_SCAN_TRIGGER = {
    dashboard: "dashboard",
    session: "session",
} as const;

export type RecipeScanTrigger = (typeof RECIPE_SCAN_TRIGGER)[keyof typeof RECIPE_SCAN_TRIGGER];

/** 이 슬라이스가 읽는 설정 항목이며 값은 추적 서비스의 설정 표가 소유한다. */
export const RECIPE_SETTING_KEY = {
    anthropicApiKey: "anthropic.api_key",
} as const;

/** 후보가 처음 놓이는 상태이며 사람이 승인해야 살아난다. */
export const RECIPE_STATUS_CANDIDATE = "candidate";

/** 후보를 만든 주체이며 사람이 고치면 값이 바뀐다. */
export const RECIPE_EDITOR_AGENT = "agent";

/** 검색 색인 아웃박스가 가리키는 대상 종류다. */
export const SEARCH_OUTBOX_TARGET_RECIPE = "recipe";
