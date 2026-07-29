import { Inject, Injectable } from "@nestjs/common";
import { toSettingView } from "~agent-api/domain/settings/model/setting.mask.policy.js";
import type { SettingView } from "~agent-api/domain/settings/model/setting.model.js";
import { SETTING_REPOSITORY, type SettingRepositoryPort } from "~agent-api/domain/settings/port/setting.repository.port.js";

/** 한 사용자가 저장해 둔 설정을 키 순서로 조회한다. */
@Injectable()
export class ListSettingsUseCase {
    constructor(
        @Inject(SETTING_REPOSITORY)
        private readonly settings: SettingRepositoryPort,
    ) {}

    async execute(scope: string): Promise<{ readonly items: readonly SettingView[] }> {
        const stored = await this.settings.listByScope(scope);
        return { items: stored.map(toSettingView) };
    }
}
