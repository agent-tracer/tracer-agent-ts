import { Inject, Injectable } from "@nestjs/common";
import { UnpricedModelError } from "~agent-api/domain/settings/model/setting.errors.js";
import { toSettingView } from "~agent-api/domain/settings/model/setting.mask.policy.js";
import { MODEL_SETTING_KEY, type SettingKey, type SettingView } from "~agent-api/domain/settings/model/setting.model.js";
import { SETTING_CLOCK, type ClockPort } from "~agent-api/domain/settings/port/clock.port.js";
import { MODEL_CATALOG, type ModelCatalogPort } from "~agent-api/domain/settings/port/model.catalog.port.js";
import { SETTING_REPOSITORY, type SettingRepositoryPort } from "~agent-api/domain/settings/port/setting.repository.port.js";

/** 설정 하나를 쓰며 모델 설정은 카탈로그가 아는 값만 받는다. */
@Injectable()
export class PutSettingUseCase {
    constructor(
        @Inject(SETTING_REPOSITORY)
        private readonly settings: SettingRepositoryPort,
        @Inject(MODEL_CATALOG)
        private readonly catalog: ModelCatalogPort,
        @Inject(SETTING_CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(scope: string, key: SettingKey, value: string): Promise<SettingView> {
        if (key === MODEL_SETTING_KEY && !this.catalog.list().some((option) => option.id === value)) {
            throw new UnpricedModelError(value);
        }
        const updatedAt = this.clock.now();
        await this.settings.save({ scope, key, value, updatedAt });
        return toSettingView({ key, value, updatedAt });
    }
}
