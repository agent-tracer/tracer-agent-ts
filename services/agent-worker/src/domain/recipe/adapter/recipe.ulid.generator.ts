import { generateUlid } from "@tracer-agent/platform";
import type { RecipeIdGeneratorPort } from "~agent-worker/domain/recipe/port/recipe.id.generator.port.js";

/** 레시피 저장 행과 검색 아웃박스에 쓸 ULID를 만든다. */
export class RecipeUlidGenerator implements RecipeIdGeneratorPort {
    next(): string {
        return generateUlid();
    }
}
