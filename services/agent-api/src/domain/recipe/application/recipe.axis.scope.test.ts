import { AGENT_AXIS, AGENT_BACKEND } from "@tracer-agent/llm";
import type { Repository } from "typeorm";
import { describe, expect, it } from "vitest";
import { OpenSearchClient } from "~agent-api/config/opensearch.client.js";
import { readContractJson } from "~agent-api/support/contract.js";
import { OpenSearchRecipeSearchAdapter } from "~agent-api/domain/recipe/adapter/opensearch.recipe.search.adapter.js";
import type { SearchOutboxEntity } from "~agent-api/domain/recipe/adapter/search.outbox.entity.js";
import { TypeOrmSearchOutboxRepository } from "~agent-api/domain/recipe/adapter/typeorm.search.outbox.repository.adapter.js";
import { RECIPE_INJECTED_EVENT_KIND, type LedgerRecord } from "~agent-api/domain/recipe/model/ledger.record.js";
import { RECIPE_OUTCOME } from "~agent-api/domain/recipe/model/recipe.const.js";
import type { RecipeApplication } from "~agent-api/domain/recipe/model/recipe.application.model.js";
import { InMemoryRecipeApplicationRepository } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.application.repository.js";
import { InMemoryRecipeRepository } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.transaction.js";
import {
    applicationRow,
    FixedClock,
    RecordingTaskReader,
    recipeRow,
    SequentialIdGenerator,
} from "~agent-api/domain/recipe/port/__fakes__/recipe.test-support.js";
import { ReportRecipeOutcomeUseCase } from "./command/report.recipe.outcome.usecase.js";
import { GetRecipeUseCase } from "./query/get.recipe.usecase.js";
import { ListRecipesUseCase } from "./query/list.recipes.usecase.js";
import { RecipeProjection } from "./recipe.projection.js";

const NOW = new Date("2026-02-01T00:00:00.000Z");

/** 이 축이 아닌 축 하나이며 두 축이 같은 원장과 같은 색인을 볼 때 무엇이 섞이는지를 보인다. */
const FOREIGN_AXIS = Object.values(AGENT_AXIS).filter((axis) => axis !== AGENT_BACKEND)[0]!;

interface AxisScopeCase {
    readonly axisScope: { readonly sites: readonly { readonly id: string; readonly name: string }[] };
}

const declaredSites = readContractJson<AxisScopeCase>("conformance/cases/recipe.ledger.json").axisScope.sites;

/** 상대 축이 만든 적용 이력이며 이 축의 조회에 섞이면 값이 두 배가 된다. */
function foreignApplication(): RecipeApplication {
    return applicationRow({ backend: FOREIGN_AXIS, id: "application-상대" });
}

function recipes(): InMemoryRecipeRepository {
    const repository = new InMemoryRecipeRepository();
    repository.seed(recipeRow());
    return repository;
}

/** 두 축이 같은 레시피와 같은 태스크에 행을 하나씩 가진 원장이다. */
function bothAxes(): InMemoryRecipeApplicationRepository {
    const repository = new InMemoryRecipeApplicationRepository();
    repository.seed(applicationRow(), foreignApplication());
    return repository;
}

/** 상대 축의 행만 있는 원장이며 이 축이 자기 행을 새로 만들어야 한다. */
function foreignOnly(): InMemoryRecipeApplicationRepository {
    const repository = new InMemoryRecipeApplicationRepository();
    repository.seed(foreignApplication());
    return repository;
}

function injectedRecord(): LedgerRecord {
    return {
        id: "event-9",
        seq: "42",
        userId: "local",
        taskId: "task-1",
        kind: RECIPE_INJECTED_EVENT_KIND,
        occurredAt: NOW,
        payload: { applicationId: "application-9", recipeId: "recipe-1" },
    };
}

/** 색인에 실제로 보낸 질의 본문을 받아 두는 전송이다. */
function capturingSearch(): { readonly client: OpenSearchClient; body: () => Record<string, unknown> } {
    let sent: Record<string, unknown> = {};
    const client = new OpenSearchClient("http://index", (_input, init) => {
        sent = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as Record<string, unknown>;
        return Promise.resolve(new Response(JSON.stringify({ hits: { hits: [] } })));
    });
    return { client, body: () => sent };
}

/** 아웃박스 조회가 실제로 건 조건을 받아 두는 저장소다. */
function capturingOutbox(): { readonly repository: Repository<SearchOutboxEntity>; where: () => unknown } {
    let condition: unknown;
    const repository = {
        find: (options: { readonly where?: unknown }) => {
            condition = options.where;
            return Promise.resolve([]);
        },
    } as unknown as Repository<SearchOutboxEntity>;
    return { repository, where: () => condition };
}

/** 계약이 열거한 자리마다 상대 축의 것을 보지 않는지를 확인하는 절차 하나씩이다. */
const CHECKS: Readonly<Record<string, () => Promise<void>>> = {
    detailApplications: async () => {
        const detail = await new GetRecipeUseCase(recipes(), bothAxes()).execute("local", "recipe-1");

        expect(detail?.applications.map((application) => application.id)).toEqual(["application-1"]);
    },
    detailStats: async () => {
        const detail = await new GetRecipeUseCase(recipes(), bothAxes()).execute("local", "recipe-1");

        expect(detail?.stats.applicationCount).toBe(1);
    },
    listStats: async () => {
        const target = new ListRecipesUseCase(recipes(), bothAxes(), new RecordingTaskReader());

        const result = await target.execute("local");

        expect(result.items.map((item) => item.stats.applicationCount)).toEqual([1]);
    },
    outcomeOpenApplication: async () => {
        const applications = foreignOnly();
        const target = new ReportRecipeOutcomeUseCase(
            recipes(),
            applications,
            new FixedClock(NOW),
            new SequentialIdGenerator(),
        );

        await target.execute({
            userId: "local",
            recipeId: "recipe-1",
            taskId: "task-1",
            outcome: RECIPE_OUTCOME.completed,
        });

        expect(applications.all().map((row) => ({ backend: row.backend, outcome: row.outcome }))).toEqual([
            { backend: FOREIGN_AXIS, outcome: null },
            { backend: AGENT_BACKEND, outcome: RECIPE_OUTCOME.completed },
        ]);
    },
    projectionAlreadyOpen: async () => {
        const applications = foreignOnly();

        await new RecipeProjection(applications).handle(injectedRecord());

        expect(applications.all().map((row) => row.backend)).toEqual([FOREIGN_AXIS, AGENT_BACKEND]);
    },
    recipeSearch: async () => {
        const search = capturingSearch();

        await new OpenSearchRecipeSearchAdapter(search.client).search("local", "빌드", 3);

        const query = search.body()["query"] as { readonly bool: { readonly filter: readonly unknown[] } };
        expect(query.bool.filter).toContainEqual({ term: { backend: AGENT_BACKEND } });
    },
    searchOutboxDrain: async () => {
        const outbox = capturingOutbox();

        await new TypeOrmSearchOutboxRepository(outbox.repository).findBatch(10);

        expect(outbox.where()).toEqual({ backend: AGENT_BACKEND });
    },
};

describe("축을 걸러 읽어야 하는 자리", () => {
    // 자리 하나를 빠뜨리면 두 축을 나란히 띄운 배치에서만 값이 두 배가 되고 한 축 배포에서는 드러나지 않는다.
    it("계약이 열거한 자리를 하나도 빠뜨리지 않고 검사한다", () => {
        expect(Object.keys(CHECKS).sort()).toEqual(declaredSites.map((site) => site.id).sort());
    });

    it.each(declaredSites.map((site) => ({ id: site.id, name: site.name })))(
        "$id 는 상대 축의 것을 보지 않는다 — $name",
        async ({ id }) => {
            await CHECKS[id]!();
        },
    );
});
