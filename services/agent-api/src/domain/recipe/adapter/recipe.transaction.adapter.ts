import { Inject, Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import type { RecipeTransactionPort, RecipeTx } from "~agent-api/domain/recipe/port/recipe.transaction.port.js";
import { RecipeEntity } from "./recipe.entity.js";
import { SearchOutboxEntity } from "./search.outbox.entity.js";
import { TypeOrmRecipeRepository } from "./typeorm.recipe.repository.adapter.js";
import { TypeOrmSearchOutboxRepository } from "./typeorm.search.outbox.repository.adapter.js";

function bind(manager: EntityManager): RecipeTx {
    return {
        recipes: new TypeOrmRecipeRepository(manager.getRepository(RecipeEntity)),
        searchOutbox: new TypeOrmSearchOutboxRepository(manager.getRepository(SearchOutboxEntity)),
    };
}

/** 저장소가 생성자로 Repository 를 받으므로 트랜잭션 매니저의 Repository 로 같은 묶음을 다시 만든다. */
@Injectable()
export class RecipeTransactionAdapter implements RecipeTransactionPort {
    constructor(@Inject(AGENT_DATA_SOURCE) private readonly dataSource: DataSource) {}

    async run<T>(work: (tx: RecipeTx) => Promise<T>): Promise<T> {
        return this.dataSource.transaction((manager) => work(bind(manager)));
    }
}
