import { describe, expect, it } from "vitest";
import { zodToClaudeOutputSchema } from "@tracer-agent/llm";
import { readAgentOutput } from "~agent-worker/support/contract.js";
import { outputSchemaShape } from "~agent-worker/support/output.schema.shape.js";
import { recipeCandidatesListSchema } from "./recipe.scan.schema.js";

describe("레시피 후보 출력 스키마", () => {
    it("칸 이름과 필수 여부와 열거값이 계약과 같다", () => {
        const built = outputSchemaShape(zodToClaudeOutputSchema(recipeCandidatesListSchema));
        const declared = outputSchemaShape(readAgentOutput("recipe-scan").schema);

        expect(JSON.stringify(built, null, 1)).toBe(JSON.stringify(declared, null, 1));
    });
});
