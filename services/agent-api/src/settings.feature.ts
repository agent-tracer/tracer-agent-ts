import { SystemClock } from "@tracer-agent/platform";
import type { DataSource } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import { AppSettingEntity } from "~agent-api/domain/settings/adapter/app.setting.entity.js";
import { LlmModelCatalogAdapter } from "~agent-api/domain/settings/adapter/llm.model.catalog.adapter.js";
import { TypeOrmSettingRepository } from "~agent-api/domain/settings/adapter/typeorm.setting.repository.adapter.js";
import { DeleteSettingUseCase } from "~agent-api/domain/settings/application/command/delete.setting.usecase.js";
import { PutSettingUseCase } from "~agent-api/domain/settings/application/command/put.setting.usecase.js";
import { ListSettingModelsUseCase } from "~agent-api/domain/settings/application/query/list.setting.models.usecase.js";
import { ListSettingsUseCase } from "~agent-api/domain/settings/application/query/list.settings.usecase.js";
import { SettingController } from "~agent-api/domain/settings/inbound/setting.controller.js";
import { SETTING_CLOCK } from "~agent-api/domain/settings/port/clock.port.js";
import { MODEL_CATALOG } from "~agent-api/domain/settings/port/model.catalog.port.js";
import { SETTING_REPOSITORY } from "~agent-api/domain/settings/port/setting.repository.port.js";

/** settings 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const settingsFeature = {
    controllers: [SettingController],
    providers: [
        ListSettingsUseCase,
        ListSettingModelsUseCase,
        PutSettingUseCase,
        DeleteSettingUseCase,
        LlmModelCatalogAdapter,
        { provide: MODEL_CATALOG, useExisting: LlmModelCatalogAdapter },
        { provide: SETTING_CLOCK, useClass: SystemClock },
        {
            provide: SETTING_REPOSITORY,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) => new TypeOrmSettingRepository(source.getRepository(AppSettingEntity)),
        },
    ],
};

/** 설정 표를 비추는 엔티티다. */
export const SETTING_ENTITIES = [AppSettingEntity] as const;
