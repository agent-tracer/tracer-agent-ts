import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { readAgentPrompt } from "~agent-worker/support/contract.js";
import { TITLE_PROMPT } from "~agent-worker/domain/title/port/__fakes__/title.test-support.js";
import {
    buildTitleRepairPrompt,
    buildTitleSystemPrompt,
    TITLE_REPAIR_TEMPLATE_KEY,
    TITLE_SYSTEM_TEMPLATE_KEY,
} from "./title.prompt.js";

const DECLARED = readAgentPrompt(AGENT.titleSuggestion.id);

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
        expect(used(buildTitleSystemPrompt(labelled(), "auto"))).toEqual(
            [...DECLARED.templates[TITLE_SYSTEM_TEMPLATE_KEY]!.slots, "languageDirective"].sort(),
        );
    });

    it("수리 템플릿이 선언한 슬롯을 빠짐없이 쓴다", () => {
        const rendered = buildTitleRepairPrompt(labelled(), "base", { suggestions: [] }, ["e1"]);

        expect(used(rendered)).toEqual([...DECLARED.templates[TITLE_REPAIR_TEMPLATE_KEY]!.slots].sort());
    });

    it("계약에 없는 슬롯을 부르면 거절한다", () => {
        expect(() => TITLE_PROMPT.slot(TITLE_SYSTEM_TEMPLATE_KEY, "toneOfVoice")).toThrow();
    });
});
