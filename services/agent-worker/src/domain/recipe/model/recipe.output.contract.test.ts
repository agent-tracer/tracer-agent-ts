import { describe, expect, it } from "vitest";
import { zodToClaudeOutputSchema } from "@tracer-agent/llm";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { readAgentCases, readAgentOutput } from "~agent-worker/support/contract.js";
import { outputSchemaShape } from "~agent-worker/support/output.schema.shape.js";
import { recipeCandidatesListSchema } from "./recipe.scan.schema.js";

const RESULT_EXAMPLE = readAgentCases<{ resultExample: unknown }>(AGENT.recipeScan.id).resultExample;

describe("레시피 후보 출력 스키마", () => {
    it("칸 이름과 필수 여부와 열거값이 계약과 같다", () => {
        const built = outputSchemaShape(zodToClaudeOutputSchema(recipeCandidatesListSchema));
        const declared = outputSchemaShape(readAgentOutput("recipe-scan").schema);

        expect(JSON.stringify(built, null, 1)).toBe(JSON.stringify(declared, null, 1));
    });

    it("계약이 예시로 적은 최종 출력을 그대로 받아 그대로 돌려준다", () => {
        const parsed = recipeCandidatesListSchema.parse(RESULT_EXAMPLE);

        expect(JSON.parse(JSON.stringify(parsed))).toEqual(RESULT_EXAMPLE);
    });
});
