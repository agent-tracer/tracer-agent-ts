import { SystemClock } from "@tracer-agent/platform";
import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import type { DataSource } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import { OpenSearchClient, resolveOpenSearchUrl } from "~agent-api/config/opensearch.client.js";
import { TRACER_API_WINDOW } from "~agent-api/config/tracer.api.token.js";
import { LedgerEventConsumer } from "~agent-api/domain/recipe/adapter/ledger.event.consumer.js";
import { OpenSearchIndexWriterAdapter } from "~agent-api/domain/recipe/adapter/opensearch.index.writer.adapter.js";
import { OpenSearchRecipeSearchAdapter } from "~agent-api/domain/recipe/adapter/opensearch.recipe.search.adapter.js";
import { RecipeApplicationEntity } from "~agent-api/domain/recipe/adapter/recipe.application.entity.js";
import { RecipeEntity } from "~agent-api/domain/recipe/adapter/recipe.entity.js";
import { RecipeTransactionAdapter } from "~agent-api/domain/recipe/adapter/recipe.transaction.adapter.js";
import { RecipeUlidGenerator } from "~agent-api/domain/recipe/adapter/recipe.ulid.generator.js";
import { SearchOutboxDrainAdapter } from "~agent-api/domain/recipe/adapter/search.outbox.drain.adapter.js";
import { SearchOutboxEntity } from "~agent-api/domain/recipe/adapter/search.outbox.entity.js";
import { TracerTaskReaderAdapter } from "~agent-api/domain/recipe/adapter/tracer.task.reader.adapter.js";
import { TypeOrmRecipeApplicationRepository } from "~agent-api/domain/recipe/adapter/typeorm.recipe.application.repository.adapter.js";
import { TypeOrmRecipeRepository } from "~agent-api/domain/recipe/adapter/typeorm.recipe.repository.adapter.js";
import { AcceptRecipeUseCase } from "~agent-api/domain/recipe/application/command/accept.recipe.usecase.js";
import { DeleteRecipeUseCase } from "~agent-api/domain/recipe/application/command/delete.recipe.usecase.js";
import { DismissRecipeUseCase } from "~agent-api/domain/recipe/application/command/dismiss.recipe.usecase.js";
import { EditRecipeUseCase } from "~agent-api/domain/recipe/application/command/edit.recipe.usecase.js";
import { ReportRecipeOutcomeUseCase } from "~agent-api/domain/recipe/application/command/report.recipe.outcome.usecase.js";
import { RetireRecipeUseCase } from "~agent-api/domain/recipe/application/command/retire.recipe.usecase.js";
import { GetRecipeUseCase } from "~agent-api/domain/recipe/application/query/get.recipe.usecase.js";
import { ListRecipesUseCase } from "~agent-api/domain/recipe/application/query/list.recipes.usecase.js";
import { SearchRecipesUseCase } from "~agent-api/domain/recipe/application/query/search.recipes.usecase.js";
import { RecipeProjection } from "~agent-api/domain/recipe/application/recipe.projection.js";
import { SearchOutboxDrainUseCase } from "~agent-api/domain/recipe/application/search.outbox.drain.usecase.js";
import { RecipeController } from "~agent-api/domain/recipe/inbound/recipe.controller.js";
import { RECIPE_CLOCK } from "~agent-api/domain/recipe/port/clock.port.js";
import { RECIPE_ID_GENERATOR } from "~agent-api/domain/recipe/port/recipe.id.generator.port.js";
import {
    RECIPE_APPLICATION_REPOSITORY,
    RECIPE_REPOSITORY,
} from "~agent-api/domain/recipe/port/recipe.repository.port.js";
import { RECIPE_SEARCH } from "~agent-api/domain/recipe/port/recipe.search.port.js";
import { RECIPE_TASK_READER } from "~agent-api/domain/recipe/port/recipe.task.reader.port.js";
import { RECIPE_TRANSACTION } from "~agent-api/domain/recipe/port/recipe.transaction.port.js";
import {
    SEARCH_INDEX_WRITER,
    SEARCH_OUTBOX_DRAIN,
} from "~agent-api/domain/recipe/port/search.outbox.drain.port.js";

export { LedgerEventConsumer, RecipeProjection };

function openSearchClient(): OpenSearchClient {
    return new OpenSearchClient(resolveOpenSearchUrl());
}

/** recipe 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const recipeFeature = {
    controllers: [RecipeController],
    providers: [
        AcceptRecipeUseCase,
        DeleteRecipeUseCase,
        DismissRecipeUseCase,
        EditRecipeUseCase,
        RetireRecipeUseCase,
        ReportRecipeOutcomeUseCase,
        GetRecipeUseCase,
        ListRecipesUseCase,
        SearchRecipesUseCase,
        SearchOutboxDrainUseCase,
        RecipeProjection,
        RecipeTransactionAdapter,
        { provide: RECIPE_TRANSACTION, useExisting: RecipeTransactionAdapter },
        SearchOutboxDrainAdapter,
        { provide: SEARCH_OUTBOX_DRAIN, useExisting: SearchOutboxDrainAdapter },
        { provide: RECIPE_CLOCK, useClass: SystemClock },
        RecipeUlidGenerator,
        { provide: RECIPE_ID_GENERATOR, useExisting: RecipeUlidGenerator },
        {
            provide: RECIPE_REPOSITORY,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) => new TypeOrmRecipeRepository(source.getRepository(RecipeEntity)),
        },
        {
            provide: RECIPE_APPLICATION_REPOSITORY,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) =>
                new TypeOrmRecipeApplicationRepository(source.getRepository(RecipeApplicationEntity)),
        },
        {
            provide: RECIPE_TASK_READER,
            inject: [TRACER_API_WINDOW],
            useFactory: (tracer: TracerApiWindow) => new TracerTaskReaderAdapter(tracer),
        },
        { provide: RECIPE_SEARCH, useFactory: () => new OpenSearchRecipeSearchAdapter(openSearchClient()) },
        { provide: SEARCH_INDEX_WRITER, useFactory: () => new OpenSearchIndexWriterAdapter(openSearchClient()) },
    ],
};

/** 레시피 원장의 표를 비추는 엔티티다. */
export const RECIPE_ENTITIES = [RecipeEntity, RecipeApplicationEntity, SearchOutboxEntity] as const;
