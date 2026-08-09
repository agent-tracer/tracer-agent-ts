import type { RecipeStatus } from "~agent-api/domain/recipe/model/recipe.const.js";
import type { Recipe } from "~agent-api/domain/recipe/model/recipe.model.js";
import type { SearchOutboxRow } from "~agent-api/domain/recipe/model/search.outbox.model.js";
import type { RecipeRepositoryPort } from "~agent-api/domain/recipe/port/recipe.repository.port.js";
import type {
    RecipeTransactionPort,
    RecipeTx,
    SearchOutboxWriterPort,
} from "~agent-api/domain/recipe/port/recipe.transaction.port.js";

/** 저장된 행과 조회 결과를 나누려고 프로토타입을 유지한 채 복제한다. */
function cloneRow<T extends object>(row: T): T {
    return Object.assign(Object.create(Object.getPrototypeOf(row) as object) as T, row);
}

/** 레시피 원장의 대역이며 지운 행을 조회에서 빼는 성질만 흉내 내고 기본 키의 유일 제약은 흉내 내지 않는다. */
export class InMemoryRecipeRepository implements RecipeRepositoryPort {
    private rows = new Map<string, Recipe>();

    seed(...recipes: readonly Recipe[]): void {
        for (const recipe of recipes) this.rows.set(recipe.id, recipe);
    }

    all(): readonly Recipe[] {
        return [...this.rows.values()];
    }

    snapshot(): Map<string, Recipe> {
        return new Map([...this.rows].map(([id, row]) => [id, cloneRow(row)]));
    }

    restore(snapshot: Map<string, Recipe>): void {
        this.rows = snapshot;
    }

    findById(id: string): Promise<Recipe | null> {
        const row = this.rows.get(id);
        return Promise.resolve(row === undefined || row.isDeleted() ? null : row);
    }

    findByStatus(userId: string, status: RecipeStatus): Promise<Recipe[]> {
        const rows = this.all()
            .filter((row) => row.userId === userId && row.status === status && !row.isDeleted())
            .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
        return Promise.resolve(rows);
    }

    upsert(recipe: Recipe): Promise<void> {
        this.rows.set(recipe.id, recipe);
        return Promise.resolve();
    }
}

/** 색인 적재의 대역이며 실물이 갖는 재시도 칸은 배출기의 몫이라 여기서 흉내 내지 않는다. */
export class InMemorySearchOutbox implements SearchOutboxWriterPort {
    private rows = new Map<string, SearchOutboxRow>();

    all(): readonly SearchOutboxRow[] {
        return [...this.rows.values()];
    }

    snapshot(): Map<string, SearchOutboxRow> {
        return new Map([...this.rows].map(([id, row]) => [id, cloneRow(row)]));
    }

    restore(snapshot: Map<string, SearchOutboxRow>): void {
        this.rows = snapshot;
    }

    enqueue(row: SearchOutboxRow): Promise<void> {
        this.rows.set(row.id, row);
        return Promise.resolve();
    }
}

/** 대역 위에서 트랜잭션 경계를 재현해 실패하면 참여 저장소를 진입 시점으로 되돌린다. */
export class InMemoryRecipeTransaction implements RecipeTransactionPort {
    readonly recipes = new InMemoryRecipeRepository();

    readonly searchOutbox = new InMemorySearchOutbox();

    async run<T>(work: (tx: RecipeTx) => Promise<T>): Promise<T> {
        const recipes = this.recipes.snapshot();
        const outbox = this.searchOutbox.snapshot();
        try {
            return await work(this);
        } catch (error) {
            this.recipes.restore(recipes);
            this.searchOutbox.restore(outbox);
            throw error;
        }
    }
}
