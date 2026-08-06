import { Injectable } from "@nestjs/common";
import { loadLlmCatalog, offeredModelIds } from "@tracer-agent/llm";
import type { ModelOption } from "~agent-api/domain/settings/model/setting.model.js";
import type { ModelCatalogPort } from "~agent-api/domain/settings/port/model.catalog.port.js";

/** 잡이 모두 함께 허용하는 모델만 고를 수 있는 값으로 낸다. */
@Injectable()
export class LlmModelCatalogAdapter implements ModelCatalogPort {
    list(): readonly ModelOption[] {
        const offered = offeredModelIds();
        return Object.entries(loadLlmCatalog().models)
            .filter(([id]) => offered.has(id))
            .map(([id, rate]) => ({ id, label: rate.label }))
            .sort((left, right) => left.id.localeCompare(right.id));
    }
}
