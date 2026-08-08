import type { JobStepPayload } from "~llm/model/job.step.js";

/** SDK가 산출을 받는 도구의 이름이며 궤적의 도구 호출에도 이 이름으로 남는다. */
export const OUTPUT_TOOL_NAME = "StructuredOutput";

/** 거절된 산출도 궤적에는 남으므로 실패한 실행에서 마지막 산출 시도를 읽는다. */
export function lastStructuredAttempt(
    steps: readonly JobStepPayload[],
): Record<string, unknown> | null {
    for (let index = steps.length - 1; index >= 0; index -= 1) {
        const calls = steps[index]?.toolCalls ?? [];
        for (let inner = calls.length - 1; inner >= 0; inner -= 1) {
            const call = calls[inner];
            if (call?.name === OUTPUT_TOOL_NAME) return call.args;
        }
    }
    return null;
}
