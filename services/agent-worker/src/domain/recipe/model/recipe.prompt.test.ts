import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import type { AgentLanguageCases } from "~agent-worker/support/contract.js";
import { readAgentCases, readAgentPrompt, readAgentTools } from "~agent-worker/support/contract.js";
import { normalizeOutputLanguage } from "~agent-worker/support/output.language.js";
import { RECIPE_PROMPT } from "~agent-worker/domain/recipe/port/__fakes__/recipe.test-support.js";
import {
    buildRecipeProbeSystemPrompt,
    buildRecipeRepairDirective,
    buildRecipeSurveySystemPrompt,
    buildRecipeSystemPrompt,
    buildRecipeUserPrompt,
    RECIPE_INVESTIGATOR_REPAIR_TEMPLATE_KEY,
    RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
    RECIPE_PROBE_SYSTEM_TEMPLATE_KEY,
    RECIPE_SURVEY_SYSTEM_TEMPLATE_KEY,
    resolveRecipePromptPin,
} from "./recipe.prompt.js";
import {
    MAX_PROBE_WEIGHT,
    MAX_REDISPATCH_PROBES,
    MAX_REDISPATCH_ROUNDS,
} from "./recipe.dispatch.schema.js";
import { RECIPE_CANDIDATE_LIMIT, RECIPE_SCAN_TOOL } from "./recipe.tool.schema.js";

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
        expect(used(buildRecipeRepairDirective(labelled()))).toEqual(
            declaredSlots(RECIPE_INVESTIGATOR_REPAIR_TEMPLATE_KEY).sort(),
        );
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

    it("자리표시자를 계약의 상한과 조율자 도구 이름으로 치환한다", () => {
        const rendered = buildRecipeSystemPrompt(RECIPE_PROMPT);

        expect(rendered).not.toContain("${");
        expect(rendered).toContain(RECIPE_SCAN_TOOL.checkCitations);
        expect(rendered).toContain(String(LIMITS["recipeCandidateLimit"]));
    });

    it("스키마가 강제하는 상한과 계약의 상한이 같다", () => {
        expect(RECIPE_CANDIDATE_LIMIT).toBe(LIMITS["recipeCandidateLimit"]);
        expect(MAX_REDISPATCH_PROBES).toBe(LIMITS["maxRedispatchProbes"]);
        expect(MAX_REDISPATCH_ROUNDS).toBe(LIMITS["maxRedispatchRounds"]);
        expect(MAX_PROBE_WEIGHT).toBe(LIMITS["maxProbeWeight"]);
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
