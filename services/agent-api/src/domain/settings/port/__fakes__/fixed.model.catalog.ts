import type { ModelOption } from "~agent-api/domain/settings/model/setting.model.js";
import type { ModelCatalogPort } from "~agent-api/domain/settings/port/model.catalog.port.js";

/** 모델 카탈로그 포트의 대역이며 생성자로 받은 목록을 그대로 낸다. */
export class FixedModelCatalog implements ModelCatalogPort {
    constructor(private readonly options: readonly ModelOption[] = []) {}

    list(): readonly ModelOption[] {
        return this.options;
    }
}
