import type { SettingKey, SettingView, StoredSetting } from "./setting.model.js";

const SENSITIVE_KEYS: readonly SettingKey[] = ["anthropic.api_key"];
const VISIBLE_TAIL = 4;
const MASK_CHARACTER = "•";
const MASK_WIDTH = 8;

/** 값 자체가 자격이라 저장할 때 암호화하고 조회할 때 가리는 키인지 답한다. */
export function isSensitiveSettingKey(key: SettingKey): boolean {
    return SENSITIVE_KEYS.includes(key);
}

/** 민감한 키의 값은 끝 네 자만 남기고 가리며 그보다 짧으면 길이만 알린다. */
export function maskSettingValue(key: SettingKey, value: string): string {
    if (!isSensitiveSettingKey(key)) return value;
    if (value.length <= VISIBLE_TAIL) return MASK_CHARACTER.repeat(value.length);
    return `${MASK_CHARACTER.repeat(MASK_WIDTH)}${value.slice(-VISIBLE_TAIL)}`;
}

/** 저장된 설정을 창구가 내는 모양으로 성형한다. */
export function toSettingView(stored: StoredSetting): SettingView {
    return {
        key: stored.key,
        maskedValue: maskSettingValue(stored.key, stored.value),
        hasValue: true,
        updatedAt: stored.updatedAt.toISOString(),
    };
}
