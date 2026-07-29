import { describe, expect, it } from "vitest";
import { InMemorySettingRepository } from "~agent-api/domain/settings/port/__fakes__/in-memory.setting.repository.js";
import { DeleteSettingUseCase } from "./delete.setting.usecase.js";

const UPDATED_AT = new Date("2026-07-30T00:00:00.000Z");

function setup() {
    const settings = new InMemorySettingRepository();
    settings.seed({ scope: "local", key: "anthropic.model", value: "claude-sonnet-5", updatedAt: UPDATED_AT });
    return { settings, usecase: new DeleteSettingUseCase(settings) };
}

describe("DeleteSettingUseCase", () => {
    it("저장된 설정을 지우고 지웠다고 알린다", async () => {
        const { settings, usecase } = setup();

        const result = await usecase.execute("local", "anthropic.model");

        expect(result).toEqual({ key: "anthropic.model", deleted: true });
        expect(await settings.findByScopeAndKey("local", "anthropic.model")).toBeNull();
    });

    it("저장된 것이 없으면 지우지 않았다고 알린다", async () => {
        const { usecase } = setup();

        expect(await usecase.execute("local", "claude.outputLanguage")).toEqual({
            key: "claude.outputLanguage",
            deleted: false,
        });
    });

    it("다른 사용자의 설정은 지우지 않는다", async () => {
        const { settings, usecase } = setup();

        expect(await usecase.execute("other", "anthropic.model")).toEqual({ key: "anthropic.model", deleted: false });
        expect(await settings.findByScopeAndKey("local", "anthropic.model")).toBe("claude-sonnet-5");
    });
});
