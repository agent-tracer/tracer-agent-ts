import { Inject, Injectable } from "@nestjs/common";
import type { ModelOption } from "~agent-api/domain/settings/model/setting.model.js";
import { MODEL_CATALOG, type ModelCatalogPort } from "~agent-api/domain/settings/port/model.catalog.port.js";

/** 모델 설정에 고를 수 있는 값을 조회한다. */
@Injectable()
export class ListSettingModelsUseCase {
    constructor(
        @Inject(MODEL_CATALOG)
        private readonly catalog: ModelCatalogPort,
    ) {}

    execute(): { readonly items: readonly ModelOption[] } {
        return { items: this.catalog.list() };
    }
}
