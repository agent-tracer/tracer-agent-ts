import { Inject, Injectable } from "@nestjs/common";
import type { SettingKey } from "~agent-api/domain/settings/model/setting.model.js";
import { SETTING_REPOSITORY, type SettingRepositoryPort } from "~agent-api/domain/settings/port/setting.repository.port.js";

/** 설정 하나를 지우고 지울 것이 있었는지 알린다. */
@Injectable()
export class DeleteSettingUseCase {
    constructor(
        @Inject(SETTING_REPOSITORY)
        private readonly settings: SettingRepositoryPort,
    ) {}

    async execute(scope: string, key: SettingKey): Promise<{ readonly key: SettingKey; readonly deleted: boolean }> {
        const deleted = await this.settings.remove(scope, key);
        return { key, deleted };
    }
}
