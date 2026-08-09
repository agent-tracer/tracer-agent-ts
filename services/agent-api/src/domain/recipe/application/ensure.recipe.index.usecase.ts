import { Inject, Injectable } from "@nestjs/common";
import { RECIPES_INDEX_DEFINITION } from "~agent-api/domain/recipe/model/recipe.index.js";
import {
    SEARCH_INDEX_ADMIN,
    type SearchIndexAdminPort,
} from "~agent-api/domain/recipe/port/search.index.admin.port.js";

/** 배출이 첫 문서를 쓰기 전에 계약이 선언한 레시피 색인을 세운다. */
@Injectable()
export class EnsureRecipeIndexUseCase {
    constructor(@Inject(SEARCH_INDEX_ADMIN) private readonly admin: SearchIndexAdminPort) {}

    async execute(): Promise<void> {
        await this.admin.ensureIndex(RECIPES_INDEX_DEFINITION);
    }
}
