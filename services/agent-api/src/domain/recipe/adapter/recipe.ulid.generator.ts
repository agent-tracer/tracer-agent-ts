import { Inject, Injectable } from "@nestjs/common";
import { generateUlid } from "@tracer-agent/platform";
import { RECIPE_CLOCK, type ClockPort } from "~agent-api/domain/recipe/port/clock.port.js";
import type { RecipeIdGeneratorPort } from "~agent-api/domain/recipe/port/recipe.id.generator.port.js";

@Injectable()
export class RecipeUlidGenerator implements RecipeIdGeneratorPort {
    constructor(@Inject(RECIPE_CLOCK) private readonly clock: ClockPort) {}

    next(): string {
        return generateUlid(this.clock.nowMs());
    }
}
