import { describe, expect, it } from "vitest";
import { CHAT_EXECUTION_PHASE, CHAT_EXECUTION_STATUS } from "~agent-api/domain/chat/model/chat.const.js";
import { ChatExecution } from "~agent-api/domain/chat/model/chat.execution.model.js";
import { mapExecution } from "~agent-api/domain/chat/model/chat.model.js";
import { toChatExecution, toChatExecutionRow } from "./chat.execution.entity.js";

function stored(): ChatExecution {
    const execution = ChatExecution.create({
        id: "execution-1",
        userId: "alice",
        threadId: "thread-1",
        replayAnchorMessageId: "message-1",
        clientRequestId: "request-1",
        inputHash: "hash-1",
        model: "claude-sonnet-4-6",
        language: "ko",
        now: new Date("2026-01-01T00:00:00.000Z"),
    });
    execution.status = CHAT_EXECUTION_STATUS.running;
    execution.phase = CHAT_EXECUTION_PHASE.tool;
    execution.draftText = "생각하는 중";
    execution.draftSeq = 7;
    execution.startedAt = new Date("2026-01-01T00:00:01.000Z");
    return execution;
}

describe("실행 원장의 행과 도메인 사이", () => {
    // 한쪽 방향만 칸을 빠뜨려도 조회는 통과하고 프레임에서만 조용히 사라지므로 여기서 잡는다.
    it("원장을 오가며 프레임이 싣는 칸을 하나도 잃지 않는다", () => {
        const before = stored();

        const after = toChatExecution(toChatExecutionRow(before));

        expect(mapExecution(after)).toEqual(mapExecution(before));
    });

    it("실행이 무엇을 하는 중인지가 행에도 도메인에도 남는다", () => {
        const row = toChatExecutionRow(stored());

        expect(row.phase).toBe(CHAT_EXECUTION_PHASE.tool);
        expect(toChatExecution(row).phase).toBe(CHAT_EXECUTION_PHASE.tool);
    });
});
