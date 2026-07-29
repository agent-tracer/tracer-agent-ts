import { describe, expect, it } from "vitest";
import { FixedModelCatalog } from "~agent-api/domain/settings/port/__fakes__/fixed.model.catalog.js";
import { ListSettingModelsUseCase } from "./list.setting.models.usecase.js";

describe("ListSettingModelsUseCase", () => {
    it("카탈로그가 아는 모델을 그대로 준다", () => {
        const catalog = new FixedModelCatalog([
            { id: "claude-opus-5", label: "Claude Opus 5" },
            { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
        ]);

        expect(new ListSettingModelsUseCase(catalog).execute()).toEqual({
            items: [
                { id: "claude-opus-5", label: "Claude Opus 5" },
                { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
            ],
        });
    });

    it("카탈로그가 비면 빈 목록을 준다", () => {
        expect(new ListSettingModelsUseCase(new FixedModelCatalog()).execute()).toEqual({ items: [] });
    });
});
