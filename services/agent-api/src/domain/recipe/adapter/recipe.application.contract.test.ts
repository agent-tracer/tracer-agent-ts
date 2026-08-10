import path from "node:path";
import { AGENT_AXIS, AGENT_BACKEND, type AgentAxis } from "@tracer-agent/llm";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONTRACT_ROOT, readContractJson } from "~agent-api/support/contract.js";
import { RECIPE_INJECTED_VIA } from "~agent-api/domain/recipe/model/recipe.const.js";
import { RecipeApplicationEntity, toRecipeApplication } from "./recipe.application.entity.js";
import { TypeOrmRecipeApplicationRepository } from "./typeorm.recipe.application.repository.adapter.js";

/** 축의 어휘를 원장이 지키는 자리이며 이 이름의 거절만 그 자리의 거절로 본다. */
const AXIS_CONSTRAINT = "recipe_applications_backend_check";

/** 이 축이 아닌 축 하나이며 두 축이 같은 표를 볼 때 무엇이 함께 서는지를 보인다. */
const FOREIGN_AXIS = Object.values(AGENT_AXIS).filter((axis) => axis !== AGENT_BACKEND)[0]!;

interface ProjectionCase {
    readonly mapping: { readonly rowIdentity: { readonly keys: readonly string[] } };
}

/** 행 하나를 가리키는 열쇠의 정본이며 구현이 다시 적은 자리를 이 목록과 대조한다. */
const ROW_IDENTITY = readContractJson<ProjectionCase>("conformance/cases/recipe.projection.json").mapping
    .rowIdentity.keys;

/** 원장에 실제로 선 기본 키의 칸을 선언 순서로 낸다. */
async function ledgerPrimaryKey(): Promise<string[]> {
    const rows: readonly { readonly name: string }[] = await ledger.source.query(
        `SELECT a.attname AS name
           FROM pg_index i
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = 'recipe_applications'::regclass AND i.indisprimary
          ORDER BY array_position(i.indkey::int2[], a.attnum)`,
    );
    return rows.map((row) => row.name);
}

let ledger: StartedLedger;

function refusedBy(error: unknown): string | undefined {
    return (error as { driverError?: { constraint?: string } }).driverError?.constraint;
}

/** 사건이 실은 식별자를 그대로 쓰는 행 하나이며 두 축이 같은 사건에서 같은 id 를 얻는다. */
function application(overrides: Partial<RecipeApplicationEntity> = {}): RecipeApplicationEntity {
    const row = new RecipeApplicationEntity();
    row.backend = AGENT_BACKEND;
    row.id = "application-1";
    row.userId = "user-1";
    row.recipeId = "recipe-1";
    row.taskId = "task-1";
    row.injectedVia = RECIPE_INJECTED_VIA.pull;
    row.outcome = null;
    row.note = null;
    row.anchorEventId = "event-1";
    row.anchorSeq = "1";
    row.createdAt = new Date("2026-01-01T00:00:00Z");
    return Object.assign(row, overrides);
}

beforeAll(async () => {
    ledger = await startLedger(path.join(CONTRACT_ROOT, "db", "migrations"), [RecipeApplicationEntity]);
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
});

describe("행 하나를 가리키는 열쇠를 계약과 원장과 엔티티가 같게 적는다", () => {
    it("원장에 선 기본 키가 계약이 적은 열쇠와 같다", async () => {
        await expect(ledgerPrimaryKey()).resolves.toEqual([...ROW_IDENTITY]);
    });

    // 엔티티의 선언은 조회와 upsert 가 쓰지 않으므로 대조하지 않으면 원장과 갈려도 조용하다.
    it("엔티티가 선언한 기본 키가 계약이 적은 열쇠와 같다", () => {
        const declared = ledger.source.getMetadata(RecipeApplicationEntity).primaryColumns;

        expect(declared.map((column) => column.databaseName)).toEqual([...ROW_IDENTITY]);
    });
});

describe("적용 이력의 행은 축까지 갖춰야 하나를 가리킨다", () => {
    // 축의 어휘를 원장이 지키지 않으면 오타 하나가 어느 조회에도 잡히지 않는 행으로 남는다.
    it("계약이 정한 어휘가 아닌 축의 행을 거절한다", async () => {
        const rows = ledger.repository(RecipeApplicationEntity);

        await expect(rows.insert(application({ backend: "rust" as AgentAxis }))).rejects.toSatisfy(
            (error: unknown) => refusedBy(error) === AXIS_CONSTRAINT,
        );
    });

    // 기본 키가 id 하나이면 뒤에 투영한 축이 앞선 축의 행을 덮어 비교할 것이 남지 않는다.
    it("같은 id 의 행이 축마다 하나씩 선다", async () => {
        const repository = new TypeOrmRecipeApplicationRepository(ledger.repository(RecipeApplicationEntity));

        await repository.upsert(toRecipeApplication(application()));
        await repository.upsert(toRecipeApplication(application({ backend: FOREIGN_AXIS })));

        await expect(ledger.repository(RecipeApplicationEntity).count()).resolves.toBe(2);
    });

    it("같은 축의 같은 id 를 다시 적으면 행이 늘지 않고 값이 덮인다", async () => {
        const repository = new TypeOrmRecipeApplicationRepository(ledger.repository(RecipeApplicationEntity));

        await repository.upsert(toRecipeApplication(application()));
        await repository.upsert(toRecipeApplication(application({ note: "다시 적은 값" })));

        const rows = await ledger.repository(RecipeApplicationEntity).find();
        expect(rows.map((row) => row.note)).toEqual(["다시 적은 값"]);
    });

    // 조회가 축을 거르지 않으면 상대 축의 행이 이 축의 통계에 함께 세어진다.
    it("조회는 자기 축의 행만 낸다", async () => {
        const repository = new TypeOrmRecipeApplicationRepository(ledger.repository(RecipeApplicationEntity));
        await repository.upsert(toRecipeApplication(application()));
        await repository.upsert(toRecipeApplication(application({ backend: FOREIGN_AXIS })));

        const byRecipe = await repository.findByRecipe("recipe-1");
        const byTask = await repository.findByTask("task-1");

        expect({ byRecipe: byRecipe.map((row) => row.backend), byTask: byTask.map((row) => row.backend) }).toEqual({
            byRecipe: [AGENT_BACKEND],
            byTask: [AGENT_BACKEND],
        });
    });
});
