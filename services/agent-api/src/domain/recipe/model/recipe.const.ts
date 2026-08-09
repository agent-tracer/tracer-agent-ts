export const RECIPE_STATUS = {
    candidate: "candidate",
    active: "active",
    dismissed: "dismissed",
    superseded: "superseded",
    retired: "retired",
} as const;

/** 레시피 상태 어휘의 정본이며 조회 스키마와 상태 없는 목록의 이어 붙이는 순서가 이 순서를 쓴다. */
export const RECIPE_STATUSES = [
    RECIPE_STATUS.candidate,
    RECIPE_STATUS.active,
    RECIPE_STATUS.dismissed,
    RECIPE_STATUS.superseded,
    RECIPE_STATUS.retired,
] as const;

export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

export const RECIPE_OUTCOME = {
    completed: "completed",
    abandoned: "abandoned",
    superseded: "superseded",
} as const;

export const RECIPE_OUTCOMES = [
    RECIPE_OUTCOME.completed,
    RECIPE_OUTCOME.abandoned,
    RECIPE_OUTCOME.superseded,
] as const;

export type RecipeOutcome = (typeof RECIPE_OUTCOMES)[number];

export const RECIPE_EDITOR = {
    agent: "agent",
    user: "user",
} as const;

export const RECIPE_EDITORS = [RECIPE_EDITOR.agent, RECIPE_EDITOR.user] as const;

export type RecipeEditor = (typeof RECIPE_EDITORS)[number];

export const RECIPE_INJECTED_VIA = {
    pull: "pull",
    manual: "manual",
} as const;

export const RECIPE_INJECTED_VIAS = [RECIPE_INJECTED_VIA.pull, RECIPE_INJECTED_VIA.manual] as const;

export type RecipeInjectedVia = (typeof RECIPE_INJECTED_VIAS)[number];

/** 이 원장이 소유한 색인 대상은 레시피 하나이며 migration 의 CHECK 가 같은 값을 받는다. */
export const SEARCH_OUTBOX_TARGET_RECIPE = "recipe";
