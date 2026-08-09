/** 사용자가 저장할 수 있는 설정 키의 전부이며 이 밖의 키는 접수되지 않는다. */
export const SETTING_KEYS = [
    "anthropic.api_key",
    "anthropic.model",
    "taskCleanup.maxSuggestions",
    "claude.outputLanguage",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

/** 값이 모델 카탈로그 안에 있어야만 저장되는 키다. */
export const MODEL_SETTING_KEY = "anthropic.model";

export function isSettingKey(value: string): value is SettingKey {
    return (SETTING_KEYS as readonly string[]).includes(value);
}

/** 한 범위 안에서 키 하나가 가리키는 평문 값과 마지막으로 쓴 시각이다. */
export interface StoredSetting {
    readonly key: SettingKey;
    readonly value: string;
    readonly updatedAt: Date;
}

/** 창구 밖으로 나가는 설정 하나이며 값 자체가 자격인 키만 가려서 싣는다. */
export interface SettingView {
    readonly key: SettingKey;
    readonly maskedValue: string;
    readonly hasValue: true;
    readonly updatedAt: string;
}

/** 사용자가 모델 설정에 고를 수 있는 값 하나다. */
export interface ModelOption {
    readonly id: string;
    readonly label: string;
}
