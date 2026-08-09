import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import type {
    SearchOutboxDrainPort,
    SearchOutboxDrainRepositories,
} from "~agent-api/domain/recipe/port/search.outbox.drain.port.js";
import { RecipeEntity } from "./recipe.entity.js";
import { SearchOutboxEntity } from "./search.outbox.entity.js";
import { TypeOrmRecipeRepository } from "./typeorm.recipe.repository.adapter.js";
import { TypeOrmSearchOutboxRepository } from "./typeorm.search.outbox.repository.adapter.js";

/** 색인 배출의 자문 잠금 열쇠이며 모든 배출기가 같은 값을 써야 한 번에 하나만 배출한다. */
const DRAIN_LOCK_KEY = 8_140_101;

/** 배출기는 자문 잠금 하나를 얻은 뒤 실행하므로 replica 가 여럿이어도 한 번에 하나만 배출한다. */
@Injectable()
export class SearchOutboxDrainAdapter implements SearchOutboxDrainPort {
    constructor(@Inject(AGENT_DATA_SOURCE) private readonly dataSource: DataSource) {}

    async withLock<T>(work: (repositories: SearchOutboxDrainRepositories) => Promise<T>): Promise<T | null> {
        return this.dataSource.transaction(async (manager) => {
            const locked: readonly { readonly locked?: boolean }[] = await manager.query(
                "SELECT pg_try_advisory_xact_lock($1) AS locked",
                [DRAIN_LOCK_KEY],
            );
            if (locked[0]?.locked !== true) return null;
            return work({
                searchOutbox: new TypeOrmSearchOutboxRepository(manager.getRepository(SearchOutboxEntity)),
                recipes: new TypeOrmRecipeRepository(manager.getRepository(RecipeEntity)),
            });
        });
    }
}
