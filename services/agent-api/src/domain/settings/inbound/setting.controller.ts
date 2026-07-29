import { Body, Controller, Delete, Get, Headers, Param, Put } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { DeleteSettingUseCase } from "~agent-api/domain/settings/application/command/delete.setting.usecase.js";
import { PutSettingUseCase } from "~agent-api/domain/settings/application/command/put.setting.usecase.js";
import { ListSettingModelsUseCase } from "~agent-api/domain/settings/application/query/list.setting.models.usecase.js";
import { ListSettingsUseCase } from "~agent-api/domain/settings/application/query/list.settings.usecase.js";
import type { SettingKey } from "~agent-api/domain/settings/model/setting.model.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { putSettingBodyPipe, settingKeyPipe, type PutSettingBody } from "./setting.schema.js";

/** 설정 조회와 쓰기와 삭제와 모델 목록의 HTTP 계약을 제공한다. */
@Controller("api/agent/settings")
export class SettingController {
    constructor(
        private readonly listSettings: ListSettingsUseCase,
        private readonly listSettingModels: ListSettingModelsUseCase,
        private readonly putSetting: PutSettingUseCase,
        private readonly deleteSetting: DeleteSettingUseCase,
    ) {}

    @Get()
    async list(@Headers(MONITOR_USER_HEADER) user: string | undefined) {
        return this.listSettings.execute(resolveUserId(user));
    }

    @Get("models")
    models() {
        return this.listSettingModels.execute();
    }

    @Put(":key")
    async put(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("key", settingKeyPipe) key: SettingKey,
        @Body(putSettingBodyPipe) body: PutSettingBody,
    ) {
        return this.putSetting.execute(resolveUserId(user), key, body.value);
    }

    @Delete(":key")
    async remove(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("key", settingKeyPipe) key: SettingKey,
    ) {
        return this.deleteSetting.execute(resolveUserId(user), key);
    }
}
