import { describe, expect, it } from "vitest";
import { fillBody, fillPath, fillQuery, TOOL_BINDINGS, toolBinding } from "./tool.binding.js";

describe("도구 바인딩", () => {
    it("계약이 선언한 도구를 모두 싣는다", () => {
        expect(Object.keys(TOOL_BINDINGS).length).toBeGreaterThan(0);
        expect(toolBinding("update_task").method).toBe("PATCH");
    });

    it("계약에 없는 도구 이름을 거절한다", () => {
        expect(() => toolBinding("drop_database")).toThrow("drop_database is not a contract tool");
    });

    it("경로 자리를 인자 값으로 채우고 이스케이프한다", () => {
        expect(fillPath(toolBinding("upsert_setting"), { key: "anthropic.api_key", value: "x" }))
            .toBe("/api/v1/settings/anthropic.api_key");
        expect(fillPath(toolBinding("get_task"), { taskId: "a/b" })).toBe("/api/v1/tasks/a%2Fb");
    });

    it("주어진 인자만 쿼리에 싣는다", () => {
        expect(fillQuery(toolBinding("search_tasks"), { status: "running", limit: 10 }))
            .toEqual({ status: "running", limit: "10" });
    });

    it("실행이 못박는 상수를 본문에 함께 싣는다", () => {
        expect(fillBody(toolBinding("create_memo"), { taskId: "t1", body: "메모" }))
            .toEqual({ author: "agent", taskId: "t1", body: "메모" });
    });

    it("계약이 정한 와이어 이름으로 본문 키를 옮긴다", () => {
        expect(fillBody(toolBinding("create_rule"), {
            taskId: "t1",
            anchorEventId: "e1",
            name: "규칙",
            expectation: { must: [] },
        })).toEqual({ taskId: "t1", anchorEventId: "e1", name: "규칙", expect: { must: [] } });
    });

    it("실을 값이 없으면 본문을 만들지 않는다", () => {
        expect(fillBody(toolBinding("archive_task"), { taskId: "t1" })).toBeNull();
    });
});
