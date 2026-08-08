import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import type { AgentLanguageCases } from "~agent-worker/support/contract.js";
import { readAgentCases, readAgentPrompt, readAgentTools, readCase } from "~agent-worker/support/contract.js";
import { normalizeOutputLanguage } from "~agent-worker/support/output.language.js";
import { RECIPE_PROMPT } from "~agent-worker/domain/recipe/port/__fakes__/recipe.test-support.js";
import {
    buildRecipeProbeSystemPrompt,
    buildRecipeProbePrompt,
    buildRecipeRepairPrompt,
    buildRecipeSurveyPrompt,
    buildRecipeSurveySystemPrompt,
    buildRecipeSystemPrompt,
    buildRecipeUserPrompt,
    RECIPE_INVESTIGATOR_REPAIR_TEMPLATE_KEY,
    RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
    RECIPE_PROBE_SYSTEM_TEMPLATE_KEY,
    RECIPE_SURVEY_SYSTEM_TEMPLATE_KEY,
    resolveRecipePromptPin,
} from "./recipe.prompt.js";
import type { ProbeAssignment } from "./recipe.dispatch.schema.js";
import {
    MAX_DISPATCH_PROBES,
    MAX_EXCERPTS_PER_PROBE,
    MAX_EXCERPT_CHARS,
    MAX_REDISPATCH_PROBES,
    MAX_REDISPATCH_ROUNDS,
    MAX_VERDICT_CHARS,
} from "./recipe.dispatch.schema.js";
import { RECIPE_CANDIDATE_LIMIT } from "./recipe.tool.schema.js";

const DECLARED = readAgentPrompt(AGENT.recipeScan.id);
const TOOLS = readAgentTools(AGENT.recipeScan.id);
const LIMITS = TOOLS.limits ?? {};
const LANGUAGE = readAgentCases<{ language: AgentLanguageCases }>(AGENT.recipeScan.id).language;

/** 계약이 그 언어 변형에 적은 조각 본문이며 조립 결과가 이 본문을 그대로 실어야 한다. */
function variant(name: string): string {
    return (DECLARED.fragments[LANGUAGE.fragment]?.byLanguage?.[name] ?? []).join("\n");
}

/** 슬롯마다 그 이름만 담은 프롬프트라 조립 결과에서 어느 슬롯을 썼는지 그대로 읽힌다. */
function labelled(): AgentPrompt {
    const templates = Object.fromEntries(
        Object.entries(DECLARED.templates).map(([templateKey, template]) => [
            templateKey,
            {
                version: template.version,
                slots: Object.fromEntries(
                    template.slots.map((slot) => [slot, { content: `<<${slot}>>`, version: template.version }]),
                ),
            },
        ]),
    );
    return new AgentPrompt(templates, { auto: "<<languageDirective>>" });
}

function used(rendered: string): readonly string[] {
    return [...rendered.matchAll(/<<([A-Za-z]+)>>/gu)].map((match) => match[1] as string).sort();
}

function declaredSlots(templateKey: string): string[] {
    return [...DECLARED.templates[templateKey]!.slots];
}

describe("레시피 조사 프롬프트", () => {
    it("조사 템플릿이 선언한 슬롯을 빠짐없이 쓴다", () => {
        expect(used(buildRecipeSystemPrompt(labelled()))).toEqual(
            declaredSlots(RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY).sort(),
        );
    });

    it("수리 템플릿이 선언한 슬롯을 빠짐없이 쓴다", () => {
        const repair = buildRecipeRepairPrompt(labelled(), "기준 지시문", { recipes: [] }, ["오류"]);

        expect(used(repair)).toEqual(declaredSlots(RECIPE_INVESTIGATOR_REPAIR_TEMPLATE_KEY).sort());
    });

    it("계획 템플릿이 선언한 슬롯을 빠짐없이 쓴다", () => {
        expect(used(buildRecipeSurveySystemPrompt(labelled()))).toEqual(
            declaredSlots(RECIPE_SURVEY_SYSTEM_TEMPLATE_KEY).sort(),
        );
    });

    it("전문가 템플릿이 선언한 슬롯을 빠짐없이 쓴다", () => {
        expect(used(buildRecipeProbeSystemPrompt(labelled()))).toEqual(
            declaredSlots(RECIPE_PROBE_SYSTEM_TEMPLATE_KEY).sort(),
        );
    });

    it("사용자 프롬프트가 언어 지시문을 싣는다", () => {
        expect(used(buildRecipeUserPrompt(labelled(), "t1", undefined, "ko"))).toEqual([
            "languageDirective",
        ]);
    });

    it("계약의 언어 케이스마다 그 변형의 조각 본문을 싣는다", () => {
        for (const declared of LANGUAGE.cases) {
            const expected = variant(declared.expect.variant);
            const language = normalizeOutputLanguage(declared.input.language);
            const rendered = buildRecipeUserPrompt(RECIPE_PROMPT, "t1", undefined, language);

            expect(expected.length, declared.expect.variant).toBeGreaterThan(0);
            expect(rendered, declared.expect.variant).toContain(expected);
        }
    });

    it("자리표시자를 계약의 상한으로 치환한다", () => {
        const rendered = buildRecipeSystemPrompt(RECIPE_PROMPT);

        expect(rendered).not.toContain("${");
        expect(rendered).toContain(String(LIMITS["recipeCandidateLimit"]));
    });

    it("스키마가 강제하는 상한과 계약의 상한이 같다", () => {
        expect(RECIPE_CANDIDATE_LIMIT).toBe(LIMITS["recipeCandidateLimit"]);
        expect(MAX_REDISPATCH_PROBES).toBe(LIMITS["maxRedispatchProbes"]);
        expect(MAX_REDISPATCH_ROUNDS).toBe(LIMITS["maxRedispatchRounds"]);
        expect(MAX_DISPATCH_PROBES).toBe(LIMITS["maxDispatchProbes"]);
        expect(MAX_EXCERPTS_PER_PROBE).toBe(LIMITS["maxProbeExcerpts"]);
        expect(MAX_EXCERPT_CHARS).toBe(LIMITS["probeExcerptChars"]);
        expect(MAX_VERDICT_CHARS).toBe(LIMITS["probeVerdictChars"]);
    });
});

describe("레시피 조사 실행에 실리는 판", () => {
    it("계약이 템플릿에 매긴 판을 그대로 싣는다", () => {
        const versions = new Set(Object.values(DECLARED.templates).map((template) => template.version));

        expect([...versions]).toEqual([resolveRecipePromptPin(RECIPE_PROMPT).promptVersion]);
    });

    it("계약이 도구 선언에 매긴 판을 그대로 싣는다", () => {
        expect(resolveRecipePromptPin(RECIPE_PROMPT).toolContractVersion).toBe(readAgentTools("recipe-scan").version);
    });
});

const PROMPT_PARITY = readCase<RecipePromptParityCases>("recipe.prompt");

interface RecipePromptParityCase {
    readonly name: string;
    readonly input: Record<string, unknown>;
    readonly mustContain?: readonly string[];
    readonly mustNotContain?: readonly string[];
    readonly mustContainLimits?: readonly string[];
}

interface RecipePromptParityCases {
    readonly survey: { readonly cases: readonly RecipePromptParityCase[] };
    readonly probe: { readonly cases: readonly RecipePromptParityCase[] };
    readonly probeSystem: { readonly cases: readonly RecipePromptParityCase[] };
    readonly investigateSystem: { readonly cases: readonly RecipePromptParityCase[] };
}

function assertParity(rendered: string, declared: RecipePromptParityCase): void {
    for (const needle of declared.mustContain ?? []) {
        expect(rendered, `${declared.name}: ${needle}`).toContain(needle);
    }
    for (const needle of declared.mustNotContain ?? []) {
        expect(rendered, `${declared.name}: ${needle}`).not.toContain(needle);
    }
    // 케이스가 숫자를 복제하지 않도록 상한은 이름으로 적고 값은 계약에서 찾는다.
    for (const key of declared.mustContainLimits ?? []) {
        const value = LIMITS[key];
        expect(value, `${declared.name}: ${key}`).toBeTypeOf("number");
        // 12 가 1200 안에서 걸리면 싣지 않은 상한도 통과하므로 수 전체로 비교한다.
        expect(rendered, `${declared.name}: ${key}`).toMatch(
            new RegExp(String.raw`(?<!\d)${String(value)}(?!\d)`, "u"),
        );
    }
}

describe("두 축이 같은 글자를 내야 하는 조사 프롬프트", () => {
    it("계약이 적은 계획 프롬프트 케이스를 모두 만족한다", () => {
        for (const declared of PROMPT_PARITY.survey.cases) {
            const rendered = buildRecipeSurveyPrompt(
                RECIPE_PROMPT,
                declared.input["taskId"] as string,
                (declared.input["userPrompt"] as string | null) ?? undefined,
                declared.input["availableTurns"] as number,
            );

            assertParity(rendered, declared);
        }
    });

    it("계약이 적은 전문가 프롬프트 케이스를 모두 만족한다", () => {
        for (const declared of PROMPT_PARITY.probe.cases) {
            const rendered = buildRecipeProbePrompt(
                RECIPE_PROMPT,
                declared.input["taskId"] as string,
                declared.input["question"] as string,
                declared.input["turns"] as number,
                declared.input["siblings"] as readonly ProbeAssignment[],
            );

            assertParity(rendered, declared);
        }
    });

    it("전문가 시스템 프롬프트가 보고를 자르는 상한을 싣는다", () => {
        const rendered = buildRecipeProbeSystemPrompt(RECIPE_PROMPT);

        for (const declared of PROMPT_PARITY.probeSystem.cases) assertParity(rendered, declared);
    });

    it("조율자 시스템 프롬프트가 산출을 자르는 상한을 싣는다", () => {
        const rendered = buildRecipeSystemPrompt(RECIPE_PROMPT);

        for (const declared of PROMPT_PARITY.investigateSystem.cases) assertParity(rendered, declared);
    });
});
