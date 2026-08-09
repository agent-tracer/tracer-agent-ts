import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { RECIPE_INJECTED_VIA, type RecipeOutcome } from "~agent-api/domain/recipe/model/recipe.const.js";
import { RecipeApplication } from "~agent-api/domain/recipe/model/recipe.application.model.js";
import { RECIPE_CLOCK, type ClockPort } from "~agent-api/domain/recipe/port/clock.port.js";
import {
    RECIPE_ID_GENERATOR,
    type RecipeIdGeneratorPort,
} from "~agent-api/domain/recipe/port/recipe.id.generator.port.js";
import {
    RECIPE_APPLICATION_REPOSITORY,
    RECIPE_REPOSITORY,
    type RecipeApplicationRepositoryPort,
    type RecipeRepositoryPort,
} from "~agent-api/domain/recipe/port/recipe.repository.port.js";
import {
    mapRecipeApplication,
    type RecipeApplicationDto,
} from "~agent-api/domain/recipe/application/recipe.support.js";

export interface ReportRecipeOutcomeInput {
    readonly userId: string;
    readonly recipeId: string;
    readonly taskId: string;
    readonly outcome: RecipeOutcome;
    readonly note?: string | undefined;
}

/** 에이전트의 자기보고이며 이 태스크에 적용 이력이 없으면 즉석에서 하나 만들어 결과를 적는다. */
@Injectable()
export class ReportRecipeOutcomeUseCase {
    constructor(
        @Inject(RECIPE_REPOSITORY) private readonly recipes: RecipeRepositoryPort,
        @Inject(RECIPE_APPLICATION_REPOSITORY) private readonly applications: RecipeApplicationRepositoryPort,
        @Inject(RECIPE_CLOCK) private readonly clock: ClockPort,
        @Inject(RECIPE_ID_GENERATOR) private readonly ids: RecipeIdGeneratorPort,
    ) {}

    async execute(input: ReportRecipeOutcomeInput): Promise<{ readonly application: RecipeApplicationDto }> {
        const recipe = await this.recipes.findById(input.recipeId);
        // 남의 레시피는 존재 자체를 알리지 않는다.
        if (recipe === null || recipe.userId !== input.userId) throw new NotFoundException("Recipe not found");

        const recorded = await this.applications.findByTask(input.taskId);
        const existing = recorded.find((application) => application.recipeId === input.recipeId);
        const application = existing ?? this.buildManualApplication(input, this.clock.now());
        application.reportOutcome(input.outcome, input.note ?? null);
        await this.applications.upsert(application);
        return { application: mapRecipeApplication(application) };
    }

    /** 사건에서 오지 않은 행이므로 사건 좌표를 비운다. */
    private buildManualApplication(input: ReportRecipeOutcomeInput, now: Date): RecipeApplication {
        const application = new RecipeApplication();
        application.id = this.ids.next();
        application.userId = input.userId;
        application.recipeId = input.recipeId;
        application.taskId = input.taskId;
        application.injectedVia = RECIPE_INJECTED_VIA.manual;
        application.outcome = null;
        application.note = null;
        application.anchorEventId = null;
        application.anchorSeq = null;
        application.createdAt = now;
        return application;
    }
}
