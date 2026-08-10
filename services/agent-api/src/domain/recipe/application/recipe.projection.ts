import { Inject, Injectable } from "@nestjs/common";
import { AGENT_BACKEND } from "@tracer-agent/llm";
import { RECIPE_INJECTED_VIA, type RecipeInjectedVia } from "~agent-api/domain/recipe/model/recipe.const.js";
import { RecipeApplication } from "~agent-api/domain/recipe/model/recipe.application.model.js";
import { RECIPE_INJECTED_EVENT_KIND, type LedgerRecord } from "~agent-api/domain/recipe/model/ledger.record.js";
import type { LedgerEventHandlerPort } from "~agent-api/domain/recipe/port/ledger.event.handler.port.js";
import {
    RECIPE_APPLICATION_REPOSITORY,
    type RecipeApplicationRepositoryPort,
} from "~agent-api/domain/recipe/port/recipe.repository.port.js";

/** 사건이 주입 경로를 싣지 않았으면 도구가 끌어온 것으로 본다. */
const DEFAULT_INJECTED_VIA: RecipeInjectedVia = RECIPE_INJECTED_VIA.pull;

/** 레시피 주입 사건을 적용 이력 행으로 투영하며 고르지 않은 종류는 넘긴다. */
@Injectable()
export class RecipeProjection implements LedgerEventHandlerPort {
    constructor(
        @Inject(RECIPE_APPLICATION_REPOSITORY) private readonly applications: RecipeApplicationRepositoryPort,
    ) {}

    async handle(record: LedgerRecord): Promise<void> {
        if (record.kind !== RECIPE_INJECTED_EVENT_KIND) return;
        const applicationId = readString(record.payload["applicationId"]);
        const recipeId = readString(record.payload["recipeId"]);
        // 행의 식별자와 대상이 없으면 만들 수 있는 행이 없다.
        if (applicationId === null || recipeId === null) return;

        // 저장소가 자기 축의 행만 내므로 상대 축이 먼저 만든 행이 이 축의 투영을 막지 않는다.
        const recorded = await this.applications.findByTask(record.taskId);
        // 같은 레시피를 한 태스크에서 여러 번 끌어와도 성공률의 분모가 부풀지 않게 한다.
        if (recorded.some((application) => application.recipeId === recipeId)) return;

        await this.applications.upsert(toApplication(applicationId, recipeId, record));
    }
}

function toApplication(applicationId: string, recipeId: string, record: LedgerRecord): RecipeApplication {
    const application = new RecipeApplication();
    // 사건이 축을 싣지 않으므로 투영하는 자리가 자기 축 상수를 적는다.
    application.backend = AGENT_BACKEND;
    application.id = applicationId;
    application.userId = record.userId;
    application.recipeId = recipeId;
    application.taskId = record.taskId;
    application.injectedVia = readInjectedVia(record.payload["injectedVia"]);
    application.outcome = null;
    application.note = null;
    application.anchorEventId = record.id;
    application.anchorSeq = record.seq;
    // 행이 쓰인 시각이 아니라 사건이 일어난 시각을 적어 이력의 시각이 배출 지연을 따라가지 않게 한다.
    application.createdAt = record.occurredAt;
    return application;
}

function readInjectedVia(value: unknown): RecipeInjectedVia {
    return value === RECIPE_INJECTED_VIA.manual ? RECIPE_INJECTED_VIA.manual : DEFAULT_INJECTED_VIA;
}

function readString(value: unknown): string | null {
    return typeof value === "string" && value.length > 0 ? value : null;
}
