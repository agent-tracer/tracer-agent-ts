/** 모델 카탈로그와 실행 한도가 이 슬라이스를 부르는 이름이며 계약의 에이전트 이름과 같다. */
export const RECIPE_FEATURE = "recipe-scan";

/** 이 슬라이스가 실행하는 잡의 종류이며 값은 계약의 잡 어휘가 소유한다. */
export const RECIPE_JOB_KIND = "recipe.scan";


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

/** 후보를 낸 주체이며 값은 산출물 창구의 어휘가 소유한다. */
export const RECIPE_AUTHOR_AGENT = "agent";
