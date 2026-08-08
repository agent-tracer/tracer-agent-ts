import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import type { AgentLanguageCases } from "~agent-worker/support/contract.js";
import { readAgentCases, readAgentPrompt, readAgentTools } from "~agent-worker/support/contract.js";
import { normalizeOutputLanguage } from "~agent-worker/support/output.language.js";
import { CLEANUP_PROMPT } from "~agent-worker/domain/cleanup/port/__fakes__/cleanup.test-support.js";
import {
    buildCleanupInspectPrompt,
    buildCleanupInspectSystemPrompt,
    buildCleanupRepairPrompt,
    buildCleanupSystemPrompt,
    buildCleanupTriageSystemPrompt,
    CLEANUP_INSPECT_SYSTEM_TEMPLATE_KEY,
    CLEANUP_INVESTIGATOR_REPAIR_TEMPLATE_KEY,
    CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
    CLEANUP_TRIAGE_SYSTEM_TEMPLATE_KEY,
    resolveCleanupPromptPin,
} from "./cleanup.prompt.js";
import { CLEANUP_MAX_EVIDENCE_EVENT_IDS } from "./cleanup.tool.schema.js";
import {
    MAX_INSPECT_EXCERPTS,
    MAX_INSPECT_REASON_CHARS,
    MAX_REDISPATCH_ROUNDS,
} from "./cleanup.dispatch.schema.js";

const DECLARED = readAgentPrompt(AGENT.taskCleanup.id);
const LIMITS = readAgentTools(AGENT.taskCleanup.id).limits ?? {};
const LANGUAGE = readAgentCases<{ language: AgentLanguageCases }>(AGENT.taskCleanup.id).language;

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

describe("정리 제안 프롬프트", () => {
    it("결정 템플릿이 선언한 슬롯을 빠짐없이 쓴다", () => {
        expect(used(buildCleanupSystemPrompt(labelled(), "auto"))).toEqual(
            [...declaredSlots(CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY), "languageDirective"].sort(),
        );
    });

    it("수리 템플릿이 선언한 슬롯을 빠짐없이 쓴다", () => {
        const rendered = buildCleanupRepairPrompt(labelled(), "base", { suggestions: [] }, ["e1"]);

        expect(used(rendered)).toEqual(declaredSlots(CLEANUP_INVESTIGATOR_REPAIR_TEMPLATE_KEY).sort());
    });

    it("선별 템플릿이 선언한 슬롯을 빠짐없이 쓴다", () => {
        expect(used(buildCleanupTriageSystemPrompt(labelled()))).toEqual(
            declaredSlots(CLEANUP_TRIAGE_SYSTEM_TEMPLATE_KEY).sort(),
        );
    });

    it("검토 템플릿이 선언한 슬롯을 빠짐없이 쓴다", () => {
        expect(used(buildCleanupInspectSystemPrompt(labelled()))).toEqual(
            declaredSlots(CLEANUP_INSPECT_SYSTEM_TEMPLATE_KEY).sort(),
        );
    });

    it("계약의 언어 케이스마다 그 변형의 조각 본문을 싣는다", () => {
        for (const declared of LANGUAGE.cases) {
            const expected = variant(declared.expect.variant);
            const language = normalizeOutputLanguage(declared.input.language);
            const rendered = buildCleanupSystemPrompt(CLEANUP_PROMPT, language);

            expect(expected.length, declared.expect.variant).toBeGreaterThan(0);
            expect(rendered, declared.expect.variant).toContain(expected);
        }
    });

    it("자리표시자를 계약의 상한 값으로 치환한다", () => {
        const rendered = buildCleanupSystemPrompt(CLEANUP_PROMPT, "auto");

        expect(rendered).not.toContain("${");
        expect(rendered).toContain(String(LIMITS["maxEvidenceEventIds"]));
    });

    it("검토 요청이 보고를 자르는 상한을 모델에게 싣는다", () => {
        const rendered = buildCleanupInspectPrompt("task-1", 3);

        expect(rendered).toContain(String(MAX_INSPECT_REASON_CHARS));
        expect(rendered).toContain(String(MAX_INSPECT_EXCERPTS));
    });

    it("스키마가 강제하는 상한과 계약의 상한이 같다", () => {
        expect(CLEANUP_MAX_EVIDENCE_EVENT_IDS).toBe(LIMITS["maxEvidenceEventIds"]);
        expect(MAX_REDISPATCH_ROUNDS).toBe(LIMITS["maxRedispatchRounds"]);
    });
});

describe("정리 제안 실행에 실리는 판", () => {
    it("계약이 템플릿에 매긴 판을 그대로 싣는다", () => {
        const versions = new Set(Object.values(DECLARED.templates).map((template) => template.version));

        expect([...versions]).toEqual([resolveCleanupPromptPin(CLEANUP_PROMPT).promptVersion]);
    });

    it("계약이 도구 선언에 매긴 판을 그대로 싣는다", () => {
        expect(resolveCleanupPromptPin(CLEANUP_PROMPT).toolContractVersion).toBe(readAgentTools("task-cleanup").version);
    });
});
