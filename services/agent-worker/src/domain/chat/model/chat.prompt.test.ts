import { describe, expect, it } from "vitest";
import { AgentPrompt, buildAgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import type { AgentLanguageCases } from "~agent-worker/support/contract.js";
import { readAgentCases, readAgentPrompt, readAgentTools } from "~agent-worker/support/contract.js";
import { normalizeOutputLanguage, OUTPUT_LANGUAGES } from "~agent-worker/support/output.language.js";
import {
    buildChatSystemPrompt,
    CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY,
    renderChatTurnContext,
} from "./chat.prompt.js";

const DECLARED = readAgentPrompt(AGENT.chat.id);
const PROMPT = buildAgentPrompt(DECLARED);
const LANGUAGE = readAgentCases<{ language: AgentLanguageCases }>(AGENT.chat.id).language;

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

describe("대화 시스템 프롬프트", () => {
    it("계약이 선언한 슬롯을 빠짐없이 쓴다", () => {
        const rendered = `${buildChatSystemPrompt(labelled())}\n${renderChatTurnContext(labelled(), "auto")}`;
        const used = [...rendered.matchAll(/<<([A-Za-z]+)>>/gu)].map((match) => match[1]);

        expect(used.sort()).toEqual(
            [...DECLARED.templates[CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY]!.slots, "languageDirective"].sort(),
        );
    });

    it("계약에 없는 슬롯을 부르면 거절한다", () => {
        expect(() => PROMPT.slot(CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY, "toneOfVoice")).toThrow();
    });

    it("계약이 갖는 언어마다 다른 지시문을 싣는다", () => {
        const directives = OUTPUT_LANGUAGES.map((language) => PROMPT.languageDirective(language));

        expect(new Set(directives).size).toBe(OUTPUT_LANGUAGES.length);
    });

    it("모르는 언어는 auto 의 지시문으로 되돌린다", () => {
        expect(PROMPT.languageDirective("kl")).toBe(PROMPT.languageDirective("auto"));
    });
});

describe("대화 프롬프트의 출력 언어", () => {
    it("계약의 언어 케이스마다 그 변형의 조각 본문을 싣는다", () => {
        for (const declared of LANGUAGE.cases) {
            const expected = variant(declared.expect.variant);
            const rendered = renderChatTurnContext(PROMPT, normalizeOutputLanguage(declared.input.language));

            expect(expected.length, declared.expect.variant).toBeGreaterThan(0);
            expect(rendered, declared.expect.variant).toContain(expected);
        }
    });
});

describe("대화 실행에 실리는 판", () => {
    it("계약이 템플릿에 매긴 판을 그대로 싣는다", () => {
        expect(PROMPT.version()).toBe(DECLARED.templates[CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY]!.version);
    });

    it("계약이 도구 선언에 매긴 판을 그대로 싣는다", () => {
        expect(readAgentTools("chat").version).toBe(DECLARED.templates[CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY]!.version);
    });
});
