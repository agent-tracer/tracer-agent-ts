import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { readContractJson } from "~agent-api/support/contract.js";
import { RECIPE_STATUSES } from "~agent-api/domain/recipe/model/recipe.const.js";
import { buildRecipeDocument, SEARCH_OUTBOX_BATCH_SIZE } from "~agent-api/domain/recipe/model/recipe.document.js";
import { recipeStats } from "~agent-api/domain/recipe/model/recipe.application.model.js";
import {
    RecipeNotActiveError,
    RecipeNotCandidateError,
    RecipeNotDeletableError,
} from "~agent-api/domain/recipe/model/recipe.errors.js";
import { applicationRow, recipeRow } from "~agent-api/domain/recipe/port/__fakes__/recipe.test-support.js";
import { CleanupStaleError } from "~agent-api/domain/cleanup/model/cleanup.errors.js";
import { mapCleanupSuggestion } from "~agent-api/domain/cleanup/application/cleanup.support.js";
import { suggestionRow } from "~agent-api/domain/cleanup/port/__fakes__/cleanup.test-support.js";
import { CleanupController } from "~agent-api/domain/cleanup/inbound/cleanup.controller.js";
import { RecipeController } from "~agent-api/domain/recipe/inbound/recipe.controller.js";
import { mapRecipe, mapRecipeApplication } from "./recipe.support.js";
import { RECIPE_SEARCH_LIMIT } from "./query/search.recipes.usecase.js";

interface LedgerCase {
    readonly shapes: Readonly<Record<string, { readonly fields: readonly string[] }>>;
    readonly windows: readonly {
        readonly method: string;
        readonly path: string;
        readonly query?: { readonly constraints?: Readonly<Record<string, Record<string, unknown>>> };
    }[];
    readonly transitions: {
        readonly recipe: Readonly<Record<string, { readonly rejection?: string }>>;
    };
    readonly rejections: readonly { readonly code: string; readonly message: string; readonly status: number }[];
}

interface SearchIndexDeclaration {
    readonly pipeline: { readonly stages: readonly { readonly name: string; readonly batchSize?: number }[] };
    readonly indices: {
        readonly recipes: {
            readonly document: { readonly fields: Readonly<Record<string, unknown>> };
            readonly query: { readonly limit: { readonly default: number; readonly min: number; readonly max: number } };
        };
    };
}

const ledgerCase = readContractJson<LedgerCase>("conformance/cases/recipe.ledger.json");
const searchIndex = readContractJson<SearchIndexDeclaration>("wire/search.index.json");

/** Nest 가 컨트롤러 하나에 적어 둔 요청 메서드의 번호이며 순서는 프레임워크가 정한다. */
const REQUEST_METHOD_NAMES = ["GET", "POST", "PUT", "DELETE", "PATCH", "ALL", "OPTIONS", "HEAD", "SEARCH"];

/** 컨트롤러 하나가 실제로 여는 창구를 메타데이터에서 읽는다. */
function routesOf(controller: new (...args: never[]) => object): string[] {
    const base = String(Reflect.getMetadata("path", controller) ?? "").replace(/^\/|\/$/gu, "");
    const prototype = controller.prototype as Record<string, unknown>;
    const routes: string[] = [];
    for (const name of Object.getOwnPropertyNames(prototype)) {
        const handler = prototype[name];
        if (typeof handler !== "function") continue;
        const path = Reflect.getMetadata("path", handler) as string | undefined;
        const method = Reflect.getMetadata("method", handler) as number | undefined;
        if (path === undefined || method === undefined) continue;
        const suffix = path.replace(/^\/|\/$/gu, "");
        routes.push(`${REQUEST_METHOD_NAMES[method] ?? String(method)} /${base}${suffix.length > 0 ? `/${suffix}` : ""}`);
    }
    return routes.sort();
}

/** 케이스가 적은 창구를 컨트롤러의 표기로 옮긴다. */
function declaredRoutes(): string[] {
    return ledgerCase.windows
        .map((window) => `${window.method} ${window.path.replaceAll(/\{(\w+)\}/gu, ":$1")}`)
        .sort();
}

describe("응답의 칸이 계약이 적은 모양과 같다", () => {
    it("레시피 한 건의 칸이 recipe 모양과 같다", () => {
        expect(Object.keys(mapRecipe(recipeRow())).sort()).toEqual(
            [...ledgerCase.shapes["recipe"]!.fields].sort(),
        );
    });

    it("목록이 내는 한 건의 칸이 recipeWithStats 모양과 같다", () => {
        const item = { ...mapRecipe(recipeRow()), stats: recipeStats([]) };

        expect(Object.keys(item).sort()).toEqual([...ledgerCase.shapes["recipeWithStats"]!.fields].sort());
    });

    it("통계의 칸이 recipeStats 모양과 같다", () => {
        expect(Object.keys(recipeStats([])).sort()).toEqual(
            [...ledgerCase.shapes["recipeStats"]!.fields].sort(),
        );
    });

    it("적용 이력 한 건의 칸이 recipeApplication 모양과 같다", () => {
        expect(Object.keys(mapRecipeApplication(applicationRow())).sort()).toEqual(
            [...ledgerCase.shapes["recipeApplication"]!.fields].sort(),
        );
    });

    it("정리 제안 한 건의 칸이 cleanupSuggestion 모양과 같다", () => {
        expect(Object.keys(mapCleanupSuggestion(suggestionRow())).sort()).toEqual(
            [...ledgerCase.shapes["cleanupSuggestion"]!.fields].sort(),
        );
    });
});

describe("창구와 어휘가 계약이 적은 것과 같다", () => {
    it("케이스가 적은 창구를 두 컨트롤러가 모두 연다", () => {
        expect([...routesOf(RecipeController), ...routesOf(CleanupController)].sort()).toEqual(declaredRoutes());
    });

    it("상태 전이가 내는 거절의 낱말이 계약과 같다", () => {
        const declared = new Map(ledgerCase.rejections.map((rejection) => [rejection.code, rejection]));
        const raised = [new RecipeNotCandidateError(), new RecipeNotActiveError(), new RecipeNotDeletableError()];

        for (const error of raised) {
            expect({ code: error.code, message: error.message, status: error.httpStatus }).toEqual({
                code: error.code,
                message: declared.get(error.code)?.message,
                status: declared.get(error.code)?.status,
            });
        }
    });

    it("낡음 거절의 낱말이 계약과 같다", () => {
        const stale = new CleanupStaleError();
        const declared = ledgerCase.rejections.find((rejection) => rejection.code === stale.code);

        expect({ message: stale.message, status: stale.httpStatus }).toEqual({
            message: declared?.message,
            status: declared?.status,
        });
    });

    it("상태 전이가 계약에 없는 거절 코드를 내지 않는다", () => {
        const declared = new Set(ledgerCase.rejections.map((rejection) => rejection.code));
        const used = Object.values(ledgerCase.transitions.recipe)
            .map((transition) => transition.rejection)
            .filter((code): code is string => code !== undefined);

        expect(used.filter((code) => !declared.has(code))).toEqual([]);
    });

    it("목록이 거르는 상태의 어휘가 계약과 같다", () => {
        const window = ledgerCase.windows.find((entry) => entry.path === "/api/agent/recipes");

        expect([...RECIPE_STATUSES]).toEqual(window?.query?.constraints?.["status"]?.["enum"]);
    });
});

describe("색인 선언과 코드가 같은 값을 쓴다", () => {
    it("색인 문서의 칸이 계약이 선언한 칸과 같다", () => {
        expect(Object.keys(buildRecipeDocument(recipeRow())).sort()).toEqual(
            Object.keys(searchIndex.indices.recipes.document.fields).sort(),
        );
    });

    it("검색 상한이 계약이 선언한 값과 같다", () => {
        expect({ ...RECIPE_SEARCH_LIMIT }).toEqual(searchIndex.indices.recipes.query.limit);
    });

    it("배출 한 번이 읽는 행의 수가 계약과 같다", () => {
        const drain = searchIndex.pipeline.stages.find((stage) => stage.name === "drain");

        expect(SEARCH_OUTBOX_BATCH_SIZE).toBe(drain?.batchSize);
    });
});
