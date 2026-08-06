import { describe, expect, it } from "vitest";
import { readContractJson } from "~llm/support/contract.js";
import { toolPacingHook } from "./tool.pacing.hook.js";

interface PacingContract {
    readonly pacing: {
        readonly progressNotice: { readonly template: string };
        readonly landingDirective: { readonly structured: string; readonly freeText: string };
    };
}

const { pacing } = readContractJson<PacingContract>("agent/shared/execution.budget.json");

function hookFor(landing: boolean, modelTurns: number, hasOutputSchema = false) {
    const hook = toolPacingHook({
        landing: () => landing,
        modelTurns: () => modelTurns,
        maxTurns: 16,
        hasOutputSchema,
    });
    return (toolName = "get_task_events") =>
        hook({ hook_event_name: "PreToolUse", tool_name: toolName } as never);
}

describe("도구 페이싱 훅", () => {
    it("예산이 남으면 쓴 턴과 총량을 계약의 문구로 건넨다", async () => {
        const output = await hookFor(false, 3)();

        const expected = pacing.progressNotice.template.replace("{used}", "3").replace("{total}", "16");
        expect(output.hookSpecificOutput.additionalContext).toBe(expected);
    });

    it("예산이 남으면 도구를 막지 않는다", async () => {
        const output = await hookFor(false, 3)();

        expect(output.hookSpecificOutput.permissionDecision).toBeUndefined();
    });

    it("예산이 다하면 그 도구만 막는다", async () => {
        const output = await hookFor(true, 16)();

        expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
    });

    it("구조화 출력을 요구한 실행에 그 형태의 마무리 지시를 준다", async () => {
        const output = await hookFor(true, 16, true)();

        expect(output.hookSpecificOutput.permissionDecisionReason).toBe(pacing.landingDirective.structured);
    });

    it("산문을 내는 실행에 그 형태의 마무리 지시를 준다", async () => {
        const output = await hookFor(true, 16, false)();

        expect(output.hookSpecificOutput.permissionDecisionReason).toBe(pacing.landingDirective.freeText);
    });

    it("예산이 다해도 산출을 내는 도구는 막지 않는다", async () => {
        // 산출 도구까지 막으면 모델이 답을 낼 통로가 없어 실행이 답 없이 끝난다.
        const output = await hookFor(true, 16, true)("StructuredOutput");

        expect(output.hookSpecificOutput.permissionDecision).toBeUndefined();
    });
});
