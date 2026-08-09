import { beforeEach, describe, expect, it } from "vitest";
import { RECIPES_INDEX_ALIAS } from "~agent-api/domain/recipe/model/recipe.document.js";
import { SearchOutboxRow } from "~agent-api/domain/recipe/model/search.outbox.model.js";
import { InMemoryRecipeRepository } from "~agent-api/domain/recipe/port/__fakes__/in-memory.recipe.transaction.js";
import { recipeRow } from "~agent-api/domain/recipe/port/__fakes__/recipe.test-support.js";
import type {
    SearchIndexWriterPort,
    SearchOutboxDrainPort,
    SearchOutboxDrainRepositories,
    SearchOutboxDrainRepositoryPort,
} from "~agent-api/domain/recipe/port/search.outbox.drain.port.js";
import { SearchOutboxDrainUseCase } from "./search.outbox.drain.usecase.js";

const NOW = new Date("2026-02-01T00:00:00.000Z");

/** 아웃박스 줄의 대역이며 실물의 정렬은 넣은 순서로 대신한다. */
class InMemoryDrainRepository implements SearchOutboxDrainRepositoryPort {
    readonly rows: SearchOutboxRow[] = [];

    readonly failures: { readonly id: string; readonly attempts: number }[] = [];

    seed(...rows: readonly SearchOutboxRow[]): void {
        this.rows.push(...rows);
    }

    findBatch(limit: number): Promise<SearchOutboxRow[]> {
        return Promise.resolve(this.rows.slice(0, limit));
    }

    delete(id: string): Promise<void> {
        const index = this.rows.findIndex((row) => row.id === id);
        if (index >= 0) this.rows.splice(index, 1);
        return Promise.resolve();
    }

    markFailed(id: string, attempts: number): Promise<void> {
        this.failures.push({ id, attempts });
        return Promise.resolve();
    }
}

/** 색인 쓰기의 대역이며 실패를 주입해 실패한 행이 남는지 볼 수 있게 한다. */
class RecordingIndexWriter implements SearchIndexWriterPort {
    readonly indexed: { readonly alias: string; readonly id: string; readonly document: Record<string, unknown> }[] = [];

    readonly deleted: { readonly alias: string; readonly id: string }[] = [];

    failure: Error | null = null;

    indexDocument(alias: string, documentId: string, document: Record<string, unknown>): Promise<void> {
        if (this.failure !== null) return Promise.reject(this.failure);
        this.indexed.push({ alias, id: documentId, document });
        return Promise.resolve();
    }

    deleteDocument(alias: string, documentId: string): Promise<void> {
        if (this.failure !== null) return Promise.reject(this.failure);
        this.deleted.push({ alias, id: documentId });
        return Promise.resolve();
    }
}

/** 자문 잠금의 대역이며 잠금을 얻지 못하는 갈래를 주입할 수 있다. */
class FakeDrainLock implements SearchOutboxDrainPort {
    acquired = true;

    constructor(private readonly repositories: SearchOutboxDrainRepositories) {}

    async withLock<T>(work: (repositories: SearchOutboxDrainRepositories) => Promise<T>): Promise<T | null> {
        if (!this.acquired) return null;
        return work(this.repositories);
    }
}

let outbox: InMemoryDrainRepository;
let recipes: InMemoryRecipeRepository;
let index: RecordingIndexWriter;
let lock: FakeDrainLock;
let target: SearchOutboxDrainUseCase;

beforeEach(() => {
    outbox = new InMemoryDrainRepository();
    recipes = new InMemoryRecipeRepository();
    index = new RecordingIndexWriter();
    lock = new FakeDrainLock({ searchOutbox: outbox, recipes });
    target = new SearchOutboxDrainUseCase(lock, index);
});

describe("색인 반영 요청을 배출한다", () => {
    it("대상 레시피를 다시 조회해 문서로 덮어쓴다", async () => {
        recipes.seed(recipeRow({ touchedFiles: [{ path: "src/a.ts", role: "write" }] }));
        outbox.seed(SearchOutboxRow.enqueueRecipe("outbox-1", "local", "recipe-1", NOW));

        await expect(target.runOnce()).resolves.toBe(1);
        expect(index.indexed[0]).toEqual({
            alias: RECIPES_INDEX_ALIAS,
            id: "recipe-1",
            document: {
                userId: "local",
                title: "빌드 실패를 되돌린다",
                intent: "빌드를 되살린다",
                description: "설명",
                useWhen: [],
                summaryMd: "요약",
                touchedFiles: ["src/a.ts"],
                status: "candidate",
                userEdited: false,
                rev: 1,
                updatedAt: "2026-01-01T00:00:00.000Z",
            },
        });
    });

    it("반영한 행은 줄에서 지운다", async () => {
        recipes.seed(recipeRow());
        outbox.seed(SearchOutboxRow.enqueueRecipe("outbox-1", "local", "recipe-1", NOW));

        await target.runOnce();

        expect(outbox.rows).toEqual([]);
    });

    it("조회로 잡히지 않는 대상은 색인에서 문서를 지운다", async () => {
        outbox.seed(SearchOutboxRow.enqueueRecipe("outbox-1", "local", "recipe-없음", NOW));

        await expect(target.runOnce()).resolves.toBe(1);
        expect(index.deleted).toEqual([{ alias: RECIPES_INDEX_ALIAS, id: "recipe-없음" }]);
    });

    it("색인 쓰기가 실패하면 행을 남기고 시도 수를 올린다", async () => {
        recipes.seed(recipeRow());
        outbox.seed(SearchOutboxRow.enqueueRecipe("outbox-1", "local", "recipe-1", NOW));
        index.failure = new Error("색인이 응답하지 않는다");

        await expect(target.runOnce()).resolves.toBe(0);
        expect({ rows: outbox.rows.length, failures: outbox.failures }).toEqual({
            rows: 1,
            failures: [{ id: "outbox-1", attempts: 1 }],
        });
    });

    it("잠금을 얻지 못하면 아무것도 배출하지 않는다", async () => {
        recipes.seed(recipeRow());
        outbox.seed(SearchOutboxRow.enqueueRecipe("outbox-1", "local", "recipe-1", NOW));
        lock.acquired = false;

        await expect(target.runOnce()).resolves.toBe(0);
        expect({ indexed: index.indexed, rows: outbox.rows.length }).toEqual({ indexed: [], rows: 1 });
    });
});
