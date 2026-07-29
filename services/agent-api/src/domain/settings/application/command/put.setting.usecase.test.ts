import { describe, expect, it } from "vitest";
import { UnpricedModelError } from "~agent-api/domain/settings/model/setting.errors.js";
import { FixedClock } from "~agent-api/domain/settings/port/__fakes__/fixed.clock.js";
import { FixedModelCatalog } from "~agent-api/domain/settings/port/__fakes__/fixed.model.catalog.js";
import { InMemorySettingRepository } from "~agent-api/domain/settings/port/__fakes__/in-memory.setting.repository.js";
import { PutSettingUseCase } from "./put.setting.usecase.js";

const NOW = new Date("2026-07-30T00:00:00.000Z");

function setup() {
    const settings = new InMemorySettingRepository();
    const catalog = new FixedModelCatalog([{ id: "claude-sonnet-5", label: "Claude Sonnet 5" }]);
    return { settings, usecase: new PutSettingUseCase(settings, catalog, new FixedClock(NOW)) };
}

describe("PutSettingUseCase", () => {
    it("쓴 설정을 가린 값으로 돌려준다", async () => {
        const { usecase } = setup();

        const written = await usecase.execute("local", "anthropic.api_key", "sk-ant-abcdefgh1234");

        expect(written).toEqual({
            key: "anthropic.api_key",
            maskedValue: "••••••••1234",
            hasValue: true,
            updatedAt: "2026-07-30T00:00:00.000Z",
        });
    });

    it("쓴 값을 저장소에 남긴다", async () => {
        const { settings, usecase } = setup();

        await usecase.execute("local", "claude.outputLanguage", "ko");

        expect(await settings.findByScopeAndKey("local", "claude.outputLanguage")).toBe("ko");
    });

    it("카탈로그가 아는 모델은 저장한다", async () => {
        const { usecase } = setup();

        const written = await usecase.execute("local", "anthropic.model", "claude-sonnet-5");

        expect(written.maskedValue).toBe("claude-sonnet-5");
    });

    it("카탈로그에 없는 모델은 거절한다", async () => {
        const { usecase } = setup();

        await expect(usecase.execute("local", "anthropic.model", "claude-unknown")).rejects.toBeInstanceOf(
            UnpricedModelError,
        );
    });

    it("거절한 모델은 저장소에 남기지 않는다", async () => {
        const { settings, usecase } = setup();

        await expect(usecase.execute("local", "anthropic.model", "claude-unknown")).rejects.toThrow();

        expect(await settings.findByScopeAndKey("local", "anthropic.model")).toBeNull();
    });

    it("같은 키를 다시 쓰면 값을 갈아 끼운다", async () => {
        const { settings, usecase } = setup();

        await usecase.execute("local", "claude.outputLanguage", "ko");
        await usecase.execute("local", "claude.outputLanguage", "en");

        expect(await settings.findByScopeAndKey("local", "claude.outputLanguage")).toBe("en");
    });
});
