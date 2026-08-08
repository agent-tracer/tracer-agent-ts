import { describe, expect, it } from "vitest";
import {
    fillBody,
    fillPath,
    fillQuery,
    TOOL_ACTION_BINDINGS,
    TOOL_BINDINGS,
    toolBinding,
    toolUpstreamPath,
} from "./tool.binding.js";

describe("도구 바인딩", () => {
    it("계약이 선언한 도구를 모두 싣는다", () => {
        expect(Object.keys(TOOL_BINDINGS).length).toBeGreaterThan(0);
        expect(toolBinding("propose_task_write", { action: "update" }).method).toBe("PATCH");
    });

    it("계약에 없는 도구 이름을 거절한다", () => {
        expect(() => toolBinding("drop_database")).toThrow("drop_database is not a contract tool");
    });

    it("계약에 없는 action 을 거절한다", () => {
        expect(() => toolBinding("propose_task_write", { action: "purge" }))
            .toThrow("propose_task_write has no purge action");
    });

    it("action 을 받는 도구를 action 없이 부르는 것을 거절한다", () => {
        expect(() => toolBinding("propose_task_write")).toThrow("propose_task_write needs an action");
    });

    it("경로 자리를 인자 값으로 채우고 이스케이프한다", () => {
        expect(fillPath(toolBinding("propose_rule_write", { action: "approve" }), { ruleId: "r1" })).toBe("/api/v1/rules/r1/approve");
        expect(fillPath(toolBinding("get_task"), { taskId: "a/b" })).toBe("/api/v1/tasks/a%2Fb");
    });

    it("주어진 인자만 쿼리에 싣는다", () => {
        expect(fillQuery(toolBinding("search_tasks"), { status: "running", limit: 10 }))
            .toEqual({ status: "running", limit: "10" });
    });

    it("실행이 못박는 상수를 본문에 함께 싣는다", () => {
        expect(fillBody(toolBinding("propose_memo_write", { action: "create" }), { taskId: "t1", body: "메모" }))
            .toEqual({ author: "agent", taskId: "t1", body: "메모" });
    });

    it("계약이 정한 와이어 이름으로 본문 키를 옮긴다", () => {
        expect(fillBody(toolBinding("propose_rule_write", { action: "create" }), {
            taskId: "t1",
            anchorEventId: "e1",
            name: "규칙",
            expectation: { must: [] },
        })).toEqual({ taskId: "t1", anchorEventId: "e1", name: "규칙", expect: { must: [] } });
    });

    it("실을 값이 없으면 본문을 만들지 않는다", () => {
        expect(fillBody(toolBinding("propose_task_write", { action: "archive" }), { taskId: "t1" })).toBeNull();
    });
});

describe("도구가 나가는 상류", () => {
    /** 소비자가 상류를 구분하는 규칙과 같이 경로의 앞 두 마디만 본다. */
    function upstreamPrefixOf(path: string): string {
        return path.split("/").slice(0, 3).join("/");
    }

    it("action 을 받지 않는 도구의 자리를 그대로 낸다", () => {
        expect(toolUpstreamPath("get_task")).toBe(TOOL_BINDINGS["get_task"]?.path);
    });

    it("action 마다 경로가 달라도 같은 상류를 가리킨다", () => {
        for (const [toolName, actions] of Object.entries(TOOL_ACTION_BINDINGS)) {
            const upstreams = new Set(Object.values(actions).map((one) => upstreamPrefixOf(one.path)));

            expect({ toolName, upstreams: [...upstreams] }).toEqual({
                toolName,
                upstreams: [upstreamPrefixOf(toolUpstreamPath(toolName))],
            });
        }
    });

    it("계약이 선언한 모든 도구의 상류를 답한다", () => {
        const names = [...Object.keys(TOOL_BINDINGS), ...Object.keys(TOOL_ACTION_BINDINGS)];

        expect(names.length).toBeGreaterThan(0);
        for (const name of names) expect(toolUpstreamPath(name)).toMatch(/^\/api\//);
    });

    it("계약에 없는 도구 이름을 거절한다", () => {
        expect(() => toolUpstreamPath("drop_database")).toThrow("drop_database is not a contract tool");
    });
});
