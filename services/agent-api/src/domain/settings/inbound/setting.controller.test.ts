import type { ArgumentMetadata } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { DeleteSettingUseCase } from "~agent-api/domain/settings/application/command/delete.setting.usecase.js";
import type { PutSettingUseCase } from "~agent-api/domain/settings/application/command/put.setting.usecase.js";
import type { ListSettingModelsUseCase } from "~agent-api/domain/settings/application/query/list.setting.models.usecase.js";
import type { ListSettingsUseCase } from "~agent-api/domain/settings/application/query/list.settings.usecase.js";
import { SettingController } from "./setting.controller.js";
import { putSettingBodyPipe, settingKeyPipe } from "./setting.schema.js";

const PARAM: ArgumentMetadata = { type: "param" };

function setup() {
    const listSettings = { execute: vi.fn().mockResolvedValue({ items: [] }) };
    const listSettingModels = { execute: vi.fn().mockReturnValue({ items: [] }) };
    const putSetting = { execute: vi.fn().mockResolvedValue({ key: "anthropic.model" }) };
    const deleteSetting = { execute: vi.fn().mockResolvedValue({ key: "anthropic.model", deleted: true }) };
    const controller = new SettingController(
        listSettings as unknown as ListSettingsUseCase,
        listSettingModels as unknown as ListSettingModelsUseCase,
        putSetting as unknown as PutSettingUseCase,
        deleteSetting as unknown as DeleteSettingUseCase,
    );
    return { controller, listSettings, listSettingModels, putSetting, deleteSetting };
}

describe("SettingController", () => {
    it("사용자 헤더를 범위로 삼아 목록을 위임한다", async () => {
        const { controller, listSettings } = setup();

        await controller.list("alice");

        expect(listSettings.execute).toHaveBeenCalledWith("alice");
    });

    it("사용자 헤더가 비면 기본 사용자로 읽는다", async () => {
        const { controller, listSettings } = setup();

        await controller.list("   ");

        expect(listSettings.execute).toHaveBeenCalledWith("local");
    });

    it("모델 목록을 위임한다", () => {
        const { controller, listSettingModels } = setup();

        controller.models();

        expect(listSettingModels.execute).toHaveBeenCalledWith();
    });

    it("본문의 값과 경로의 키를 쓰기에 위임한다", async () => {
        const { controller, putSetting } = setup();

        await controller.put("alice", "anthropic.model", { value: "claude-sonnet-5" });

        expect(putSetting.execute).toHaveBeenCalledWith("alice", "anthropic.model", "claude-sonnet-5");
    });

    it("경로의 키를 삭제에 위임한다", async () => {
        const { controller, deleteSetting } = setup();

        await controller.remove("alice", "anthropic.model");

        expect(deleteSetting.execute).toHaveBeenCalledWith("alice", "anthropic.model");
    });
});

describe("설정 창구의 요청 스키마", () => {
    it("계약이 정한 키를 통과시킨다", () => {
        expect(() => settingKeyPipe.transform("ruleGen.maxRulesPerTask", PARAM)).toThrow();
    });

    it("계약 밖의 키를 거절한다", () => {
        expect(() => settingKeyPipe.transform("anthropic.temperature", PARAM)).toThrow();
    });

    it("본문의 값을 문자열로 읽는다", () => {
        expect(putSettingBodyPipe.transform({ value: "ko" }, PARAM)).toEqual({ value: "ko" });
    });

    it("본문에 값이 없으면 거절한다", () => {
        expect(() => putSettingBodyPipe.transform({}, PARAM)).toThrow();
    });

    it("빈 문자열을 값으로 받지 않는다", () => {
        expect(() => putSettingBodyPipe.transform({ value: "" }, PARAM)).toThrow();
    });
});
