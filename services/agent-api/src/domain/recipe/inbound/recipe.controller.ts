import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, NotFoundException, Param, Patch, Post, Query } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { AcceptRecipeUseCase } from "~agent-api/domain/recipe/application/command/accept.recipe.usecase.js";
import { DeleteRecipeUseCase } from "~agent-api/domain/recipe/application/command/delete.recipe.usecase.js";
import { DismissRecipeUseCase } from "~agent-api/domain/recipe/application/command/dismiss.recipe.usecase.js";
import { EditRecipeUseCase } from "~agent-api/domain/recipe/application/command/edit.recipe.usecase.js";
import { ReportRecipeOutcomeUseCase } from "~agent-api/domain/recipe/application/command/report.recipe.outcome.usecase.js";
import { RetireRecipeUseCase } from "~agent-api/domain/recipe/application/command/retire.recipe.usecase.js";
import { GetRecipeUseCase } from "~agent-api/domain/recipe/application/query/get.recipe.usecase.js";
import { ListRecipesUseCase } from "~agent-api/domain/recipe/application/query/list.recipes.usecase.js";
import { SearchRecipesUseCase } from "~agent-api/domain/recipe/application/query/search.recipes.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import {
    editBodySchema,
    listQuerySchema,
    outcomeBodySchema,
    searchQuerySchema,
    type EditBody,
    type ListQuery,
    type OutcomeBody,
    type SearchQuery,
} from "./recipe.schema.js";

/** 레시피 원장의 조회와 상태 변경 창구이며 만드는 자리는 잡의 종결 단계가 갖는다. */
@Controller("api/agent/recipes")
export class RecipeController {
    constructor(
        private readonly listRecipes: ListRecipesUseCase,
        private readonly searchRecipes: SearchRecipesUseCase,
        private readonly getRecipe: GetRecipeUseCase,
        private readonly acceptRecipe: AcceptRecipeUseCase,
        private readonly dismissRecipe: DismissRecipeUseCase,
        private readonly retireRecipe: RetireRecipeUseCase,
        private readonly editRecipe: EditRecipeUseCase,
        private readonly deleteRecipe: DeleteRecipeUseCase,
        private readonly reportOutcome: ReportRecipeOutcomeUseCase,
    ) {}

    @Get()
    async list(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(listQuerySchema)) query: ListQuery,
    ) {
        return this.listRecipes.execute(resolveUserId(user), query.status);
    }

    // 고정 경로를 식별자 경로보다 먼저 선언해야 search 라는 식별자가 이 창구에 닿는다.
    @Get("search")
    async search(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(searchQuerySchema)) query: SearchQuery,
    ) {
        return this.searchRecipes.execute({ userId: resolveUserId(user), q: query.q, limit: query.limit });
    }

    @Get(":id")
    async get(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        const detail = await this.getRecipe.execute(resolveUserId(user), id);
        if (detail === null) throw new NotFoundException("Recipe not found");
        return detail;
    }

    @Post(":id/accept")
    @HttpCode(HttpStatus.OK)
    async accept(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.acceptRecipe.execute(resolveUserId(user), id);
    }

    @Post(":id/dismiss")
    @HttpCode(HttpStatus.OK)
    async dismiss(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.dismissRecipe.execute(resolveUserId(user), id);
    }

    @Post(":id/retire")
    @HttpCode(HttpStatus.OK)
    async retire(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.retireRecipe.execute(resolveUserId(user), id);
    }

    @Post(":id/outcome")
    @HttpCode(HttpStatus.OK)
    async outcome(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(outcomeBodySchema)) body: OutcomeBody,
    ) {
        return this.reportOutcome.execute({
            userId: resolveUserId(user),
            recipeId: id,
            taskId: body.taskId,
            outcome: body.outcome,
            note: body.note,
        });
    }

    @Patch(":id")
    async edit(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(editBodySchema)) body: EditBody,
    ) {
        return this.editRecipe.execute(resolveUserId(user), id, body);
    }

    @Delete(":id")
    @HttpCode(HttpStatus.OK)
    async remove(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
    ) {
        return this.deleteRecipe.execute(resolveUserId(user), id);
    }
}
