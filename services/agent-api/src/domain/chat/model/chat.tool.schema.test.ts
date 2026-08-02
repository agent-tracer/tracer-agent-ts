import { describe, expect, it } from "vitest";
import {
    CHAT_CONFIRM_TOOLS,
    CHAT_TOOL_CONTRACT,
    CHAT_TOOLS,
    parseChatToolArgs,
} from "./chat.tool.schema.js";

describe("대화 도구 계약", () => {
    it("계약이 선언한 도구를 그대로 연다", () => {
        expect(CHAT_TOOLS).toContain("search_tasks");
        expect(CHAT_TOOLS.length).toBe(Object.keys(CHAT_TOOL_CONTRACT.tools).length);
    });

    it("확인 게이트가 필요한 도구만 쓰기로 가른다", () => {
        expect(CHAT_CONFIRM_TOOLS).toContain("update_task");
        expect(CHAT_CONFIRM_TOOLS).not.toContain("search_tasks");
    });

    it("필수 인자가 없으면 거절한다", () => {
        expect(() => parseChatToolArgs("get_task", {})).toThrow();
    });

    it("열거 밖의 값을 거절한다", () => {
        expect(() => parseChatToolArgs("search_tasks", { status: "unknown" })).toThrow();
    });

    it("상한을 넘는 수치를 거절한다", () => {
        expect(() => parseChatToolArgs("search_tasks", { limit: 1000 })).toThrow();
    });

    it("계약이 허용한 인자만 좁혀 낸다", () => {
        expect(parseChatToolArgs("update_task", { taskId: "t1", title: "제목" }))
            .toEqual({ taskId: "t1", title: "제목" });
    });

    it("배열 인자를 배열로 받고 문자열을 거절한다", () => {
        expect(parseChatToolArgs("set_task_tags", { taskId: "t1", tagIds: ["g1", "g2"] }))
            .toEqual({ taskId: "t1", tagIds: ["g1", "g2"] });
        expect(() => parseChatToolArgs("set_task_tags", { taskId: "t1", tagIds: '["g1"]' })).toThrow();
    });

    it("객체 인자를 객체로 받고 문자열을 거절한다", () => {
        expect(parseChatToolArgs("enqueue_job", { kind: "title.suggestion", input: { taskId: "t1" } }))
            .toEqual({ kind: "title.suggestion", input: { taskId: "t1" } });
        expect(() => parseChatToolArgs("enqueue_job", { kind: "title.suggestion", input: "{}" })).toThrow();
    });

    it("계약에 없는 도구 이름을 거절한다", () => {
        expect(() => parseChatToolArgs("summon_dragon", {})).toThrow();
    });
});
