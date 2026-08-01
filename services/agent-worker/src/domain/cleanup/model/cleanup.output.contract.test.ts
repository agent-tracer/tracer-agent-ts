import { describe, expect, it } from "vitest";
import { zodToClaudeOutputSchema } from "@tracer-agent/llm";
import { readAgentOutput } from "~agent-worker/support/contract.js";
import { outputSchemaShape } from "~agent-worker/support/output.schema.shape.js";
import { cleanupSuggestionsListSchema } from "./cleanup.suggestion.schema.js";

describe("정리 제안 출력 스키마", () => {
    it("칸 이름과 필수 여부와 열거값이 계약과 같다", () => {
        const built = outputSchemaShape(zodToClaudeOutputSchema(cleanupSuggestionsListSchema));
        const declared = outputSchemaShape(readAgentOutput("task-cleanup").schema);

        expect(JSON.stringify(built, null, 1)).toBe(JSON.stringify(declared, null, 1));
    });
});
