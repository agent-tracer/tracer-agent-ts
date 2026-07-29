import { describe, expect, it } from "vitest";
import { InMemoryEvaluationExecutionReader } from "~agent-api/domain/evaluation/port/__fakes__/in-memory.execution.reader.js";
import { BuildExecutionExampleCandidateUseCase } from "./build.execution.example.candidate.usecase.js";

describe("BuildExecutionExampleCandidateUseCase", () => {
    it("완료된 잡의 결과와 도구 근거를 사례 후보로 만든다", async () => {
        const reader = new InMemoryEvaluationExecutionReader();
        reader.jobs.set("job-1", {
            id: "job-1",
            userId: "user-1",
            kind: "title_suggestion",
            status: "completed",
            input: { currentTitle: "전" },
            result: { suggestions: [] },
        });
        reader.jobSteps.set("job-1", [{
            role: "tool",
            toolName: "get_task",
            content: "{\"id\":\"task-1\"}",
            truncated: false,
        }]);
        const result = await new BuildExecutionExampleCandidateUseCase(reader).execute("user-1", "job-1");
        expect(result.evidence).toEqual({ get_task: { id: "task-1" } });
    });
});
