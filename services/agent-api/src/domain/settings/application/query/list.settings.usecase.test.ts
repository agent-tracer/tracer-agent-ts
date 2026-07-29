import { describe, expect, it } from "vitest";
import { InMemorySettingRepository } from "~agent-api/domain/settings/port/__fakes__/in-memory.setting.repository.js";
import { ListSettingsUseCase } from "./list.settings.usecase.js";

const UPDATED_AT = new Date("2026-07-30T00:00:00.000Z");

function makeUseCase(): ListSettingsUseCase {
    const settings = new InMemorySettingRepository();
    settings.seed(
        { scope: "local", key: "anthropic.api_key", value: "sk-ant-abcdefgh1234", updatedAt: UPDATED_AT },
        { scope: "local", key: "anthropic.model", value: "claude-sonnet-5", updatedAt: UPDATED_AT },
        { scope: "other", key: "claude.outputLanguage", value: "ko", updatedAt: UPDATED_AT },
    );
    return new ListSettingsUseCase(settings);
}

describe("ListSettingsUseCase", () => {
    it("이 사용자가 저장한 설정만 준다", async () => {
        const { items } = await makeUseCase().execute("local");

        expect(items.map((item) => item.key)).toEqual(["anthropic.api_key", "anthropic.model"]);
    });

    it("자격 키의 값을 가려서 준다", async () => {
        const { items } = await makeUseCase().execute("local");

        expect(items[0]).toEqual({
            key: "anthropic.api_key",
            maskedValue: "••••••••1234",
            hasValue: true,
            updatedAt: "2026-07-30T00:00:00.000Z",
        });
    });

    it("저장한 것이 없으면 빈 목록을 준다", async () => {
        const { items } = await makeUseCase().execute("nobody");

        expect(items).toEqual([]);
    });
});
