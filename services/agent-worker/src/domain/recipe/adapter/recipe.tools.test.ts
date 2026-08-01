import { describe, expect, it } from "vitest";
import { RECIPE_SCAN_TOOL_NAMES } from "~agent-worker/domain/recipe/model/recipe.tool.schema.js";
import type {
    RecipeEventReaderPort,
    RecipeRuleReaderPort,
    RecipeTaskReaderPort,
} from "~agent-worker/domain/recipe/port/recipe.reader.port.js";
import type { RecipeSearchPort } from "~agent-worker/domain/recipe/port/recipe.search.port.js";
import { buildRecipeToolHandlers } from "./recipe.tools.js";

const tasks: RecipeTaskReaderPort = { findById: () => Promise.resolve(null) };
const events: RecipeEventReaderPort = {
    findTimeline: () => Promise.resolve([]),
    findTimelineWindow: () => Promise.resolve([]),
    countByTask: () => Promise.resolve(0),
};
const rules: RecipeRuleReaderPort = { findApplicable: () => Promise.resolve([]) };
const search: RecipeSearchPort = {
    searchEvents: () => Promise.resolve({ events: [], total: 0, truncated: false }),
    searchTasks: () => Promise.resolve([]),
    searchRecipes: () => Promise.resolve([]),
};

describe("레시피 조사 도구 핸들러", () => {
    it("계약이 선언한 도구 이름마다 핸들러를 세운다", () => {
        const handlers = buildRecipeToolHandlers("user-1", { tasks, events, rules, search });

        expect(Object.keys(handlers).sort()).toEqual([...RECIPE_SCAN_TOOL_NAMES].sort());
    });
});
