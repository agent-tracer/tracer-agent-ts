import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import type { AgentLanguageCases } from "~agent-worker/support/contract.js";
import { readAgentCases, readAgentPrompt, readAgentTools } from "~agent-worker/support/contract.js";
import { normalizeOutputLanguage } from "~agent-worker/support/output.language.js";
import { TITLE_PROMPT } from "~agent-worker/domain/title/port/__fakes__/title.test-support.js";
import type { TitleContext } from "./title.context.model.js";
import {
    buildTitleRepairPrompt,
    buildTitleSystemPrompt,
    buildTitleUserPrompt,
    TITLE_REPAIR_TEMPLATE_KEY,
    TITLE_SYSTEM_TEMPLATE_KEY,
    resolveTitlePromptPin,
} from "./title.prompt.js";

const DECLARED = readAgentPrompt(AGENT.titleSuggestion.id);
const CONTRACT = readAgentCases<{
    contextExample: TitleContext;
    language: AgentLanguageCases;
}>(AGENT.titleSuggestion.id);

/** 계약이 그 언어 변형에 적은 조각 본문이며 조립 결과가 이 본문을 그대로 실어야 한다. */
function variant(name: string): string {
    return (DECLARED.fragments[CONTRACT.language.fragment]?.byLanguage?.[name] ?? []).join("\n");
}

/** 계약이 예시로 적은 컨텍스트가 담은 문장 전부이며 프롬프트가 하나도 빠뜨리면 안 된다. */
function texts(value: unknown): readonly string[] {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap(texts);
    if (value !== null && typeof value === "object") return Object.values(value).flatMap(texts);
    return [];
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

describe("제목 제안 프롬프트", () => {
    it("조사 템플릿이 선언한 슬롯을 빠짐없이 쓴다", () => {
        expect(used(buildTitleSystemPrompt(labelled()))).toEqual(
            [...DECLARED.templates[TITLE_SYSTEM_TEMPLATE_KEY]!.slots].sort(),
        );
    });

    it("수리 템플릿이 선언한 슬롯을 빠짐없이 쓴다", () => {
        const rendered = buildTitleRepairPrompt(labelled(), "base", { suggestions: [] }, ["e1"]);

        expect(used(rendered)).toEqual([...DECLARED.templates[TITLE_REPAIR_TEMPLATE_KEY]!.slots].sort());
    });

    it("계약에 없는 슬롯을 부르면 거절한다", () => {
        expect(() => TITLE_PROMPT.slot(TITLE_SYSTEM_TEMPLATE_KEY, "toneOfVoice")).toThrow();
    });

    it("계약의 언어 케이스마다 그 변형의 조각 본문을 사용자 프롬프트가 싣는다", () => {
        for (const declared of CONTRACT.language.cases) {
            const expected = variant(declared.expect.variant);
            const language = normalizeOutputLanguage(declared.input.language);
            const rendered = buildTitleUserPrompt(TITLE_PROMPT, "task-1", CONTRACT.contextExample, language);

            expect(expected.length, declared.expect.variant).toBeGreaterThan(0);
            expect(rendered, declared.expect.variant).toContain(expected);
        }
    });

    // 시스템 프롬프트가 언어를 실으면 캐시가 언어 수만큼 갈라져 어느 실행도 앞 실행의 접두사를 쓰지 못한다.
    it("시스템 프롬프트가 어느 언어의 지시문도 싣지 않는다", () => {
        const rendered = buildTitleSystemPrompt(TITLE_PROMPT);

        for (const declared of CONTRACT.language.cases) {
            expect(rendered, declared.expect.variant).not.toContain(variant(declared.expect.variant));
        }
    });

    it("계약이 예시로 적은 컨텍스트의 문장을 사용자 프롬프트가 빠짐없이 싣는다", () => {
        const rendered = buildTitleUserPrompt(TITLE_PROMPT, "task-1", CONTRACT.contextExample, "auto");

        for (const text of texts(CONTRACT.contextExample)) expect(rendered).toContain(text);
    });
});

describe("제목 제안 실행에 실리는 판", () => {
    it("계약이 템플릿에 매긴 판을 그대로 싣는다", () => {
        const versions = new Set(Object.values(DECLARED.templates).map((template) => template.version));

        expect([...versions]).toEqual([resolveTitlePromptPin(TITLE_PROMPT).promptVersion]);
    });

    it("계약이 도구 선언에 매긴 판을 그대로 싣는다", () => {
        expect(resolveTitlePromptPin(TITLE_PROMPT).toolContractVersion).toBe(readAgentTools("title-suggestion").version);
    });
});
