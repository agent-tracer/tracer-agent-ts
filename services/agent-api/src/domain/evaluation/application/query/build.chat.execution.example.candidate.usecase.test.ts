import { describe, expect, it } from "vitest";
import { InMemoryEvaluationExecutionReader } from "~agent-api/domain/evaluation/port/__fakes__/in-memory.execution.reader.js";
import { BuildChatExecutionExampleCandidateUseCase } from "./build.chat.execution.example.candidate.usecase.js";

describe("BuildChatExecutionExampleCandidateUseCase", () => {
    it("완료된 대화 실행의 두 메시지를 사례 후보로 만든다", async () => {
        const reader = new InMemoryEvaluationExecutionReader();
        reader.chatExecutions.set("execution-1", {
            id: "execution-1",
            userId: "user-1",
            status: "completed",
            userMessageId: "message-1",
            assistantMessageId: "message-2",
        });
        reader.chatMessages.set("message-1", { id: "message-1", content: "질문" });
        reader.chatMessages.set("message-2", { id: "message-2", content: "답변" });
        const result = await new BuildChatExecutionExampleCandidateUseCase(reader)
            .execute("user-1", "execution-1");
        expect(result.referenceOutput).toEqual({ response: "답변" });
    });
});
