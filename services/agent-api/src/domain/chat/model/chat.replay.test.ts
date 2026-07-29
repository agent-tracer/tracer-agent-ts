import { describe, expect, it } from "vitest";
import { CHAT_MESSAGE_ROLE } from "./chat.const.js";
import { ChatMessage, type ChatToolCall } from "./chat.message.model.js";
import { buildChatReplay } from "./chat.replay.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");
let sequence = 0;

function at(): Date {
    sequence += 1;
    return new Date(NOW.getTime() + sequence * 1000);
}

function user(id: string, content: string): ChatMessage {
    return ChatMessage.create({ id, threadId: "t1", role: CHAT_MESSAGE_ROLE.user, content, now: at() });
}

function assistant(id: string, content: string, toolCalls?: readonly ChatToolCall[]): ChatMessage {
    return ChatMessage.create({
        id,
        threadId: "t1",
        role: CHAT_MESSAGE_ROLE.assistant,
        content,
        ...(toolCalls !== undefined ? { toolCalls } : {}),
        now: at(),
    });
}

function tool(id: string, content: string, toolCallId: string): ChatMessage {
    return ChatMessage.create({
        id, threadId: "t1", role: CHAT_MESSAGE_ROLE.tool, content, toolCallId, now: at(),
    });
}

const CALL: ChatToolCall = { id: "call-1", name: "archive_task", args: { taskId: "task-1" } };

describe("buildChatReplay", () => {
    it("이번 턴의 사용자 메시지 뒤는 이력으로 세지 않는다", () => {
        const replay = buildChatReplay(
            [user("m1", "안녕"), assistant("m2", "네"), user("m3", "이어서"), assistant("m4", "아직")],
            "m3",
            null,
        );

        expect(replay.map((message) => message.content)).toEqual(["안녕", "네", "이어서"]);
    });

    it("결과가 이어진 도구 호출은 인용을 그대로 남긴다", () => {
        const replay = buildChatReplay(
            [assistant("m1", "부른다", [CALL]), tool("m2", "결과", "call-1"), user("m3", "고마워")],
            "m3",
            null,
        );

        expect(replay[0]!.toolCalls).toEqual([CALL]);
        expect(replay[1]!.toolCallId).toBe("call-1");
    });

    it("짝을 잃은 도구 결과는 인용을 지우고 평문으로 남긴다", () => {
        const replay = buildChatReplay(
            [assistant("m1", "부른다", [CALL]), user("m2", "잠깐"), tool("m3", "뒤늦은 결과", "call-1"), user("m4", "이어서")],
            "m4",
            null,
        );

        expect(replay.some((message) => message.toolCalls !== undefined)).toBe(false);
        expect(replay.find((message) => message.content === "뒤늦은 결과")?.toolCallId).toBeUndefined();
    });

    it("호출만 남은 빈 어시스턴트 메시지는 재생하지 않는다", () => {
        const replay = buildChatReplay(
            [assistant("m1", "", [CALL]), user("m2", "이어서")],
            "m2",
            null,
        );

        expect(replay.map((message) => message.content)).toEqual(["이어서"]);
    });

    it("이력에 없는 사용자 메시지를 가리키면 거절한다", () => {
        expect(() => buildChatReplay([user("m1", "안녕")], "없음", null))
            .toThrow("Chat replay message not found");
    });
});
