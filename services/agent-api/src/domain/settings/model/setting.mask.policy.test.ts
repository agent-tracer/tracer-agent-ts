import { describe, expect, it } from "vitest";
import { isSensitiveSettingKey, maskSettingValue, toSettingView } from "./setting.mask.policy.js";

const UPDATED_AT = new Date("2026-07-30T00:00:00.000Z");

describe("설정 가림 정책", () => {
    it("자격 키의 값은 끝 네 자만 남기고 가린다", () => {
        expect(maskSettingValue("anthropic.api_key", "sk-ant-abcdefgh1234")).toBe("••••••••1234");
    });

    it("자격 키의 값이 네 자 이하이면 길이만큼만 가린다", () => {
        expect(maskSettingValue("anthropic.api_key", "abc")).toBe("•••");
    });

    it("자격이 아닌 키의 값은 그대로 낸다", () => {
        expect(maskSettingValue("anthropic.model", "claude-sonnet-5")).toBe("claude-sonnet-5");
    });

    it("자격 키만 민감한 것으로 센다", () => {
        expect(isSensitiveSettingKey("anthropic.api_key")).toBe(true);
        expect(isSensitiveSettingKey("claude.outputLanguage")).toBe(false);
    });

    it("저장된 설정을 가린 값과 시각 문자열로 성형한다", () => {
        const view = toSettingView({ key: "anthropic.api_key", value: "sk-ant-abcdefgh1234", updatedAt: UPDATED_AT });

        expect(view).toEqual({
            key: "anthropic.api_key",
            maskedValue: "••••••••1234",
            hasValue: true,
            updatedAt: "2026-07-30T00:00:00.000Z",
        });
    });
});
