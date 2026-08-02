import { z } from "zod";
import type { AgentEffortLevel } from "~llm/runner/llm.runner.js";
import { readContractJson } from "~llm/support/contract.js";

// AgentEffortLevel과 같은 목록이며 model.envelope.json의 effort.values와 시작 시 대조한다.
export const MODEL_ENVELOPE_EFFORT_VALUES = [
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
] as const satisfies readonly AgentEffortLevel[];

const THINKING_VALUES = ["adaptive", "disabled"] as const;

const vocabularyFieldSchema = z.object({ values: z.array(z.string()).min(1) }).passthrough();

const modelEnvelopeContractSchema = z
    .object({
        fields: z.object({
            maxOutputTokens: z.object({ perModel: z.boolean() }).passthrough(),
            effort: vocabularyFieldSchema,
            thinking: vocabularyFieldSchema,
        }),
    })
    .passthrough();

let asserted = false;

/** 이 구현이 쓰는 effort와 thinking 어휘가 계약과 같은지 확인만 하고 값은 고치지 않는다. */
export function assertModelEnvelopeVocabulary(): void {
    if (asserted) return;
    const contract = modelEnvelopeContractSchema.parse(
        readContractJson<unknown>("agent/shared/model.envelope.json"),
    );
    assertSameValues("effort", contract.fields.effort.values, MODEL_ENVELOPE_EFFORT_VALUES);
    assertSameValues("thinking", contract.fields.thinking.values, THINKING_VALUES);
    asserted = true;
}

function assertSameValues(field: string, declared: readonly string[], expected: readonly string[]): void {
    const sortedDeclared = [...declared].sort().join(",");
    const sortedExpected = [...expected].sort().join(",");
    if (sortedDeclared !== sortedExpected) {
        throw new Error(
            `model.envelope.json: ${field} values are [${sortedDeclared}], expected [${sortedExpected}]`,
        );
    }
}
