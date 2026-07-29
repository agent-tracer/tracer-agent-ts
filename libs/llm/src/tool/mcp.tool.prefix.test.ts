import { describe, expect, it } from "vitest";
import { mcpToolName, stripMcpToolPrefix, withMcpToolPrefix } from "./mcp.tool.prefix.js";

describe("withMcpToolPrefix", () => {
    it("모델이 실제로 부를 수 있는 이름으로 지시문의 도구 이름을 바꾼다", () => {
        expect(withMcpToolPrefix("Call list_candidate_tasks first.", ["list_candidate_tasks"], "monitor-chat")).toBe(
            "Call mcp__monitor-chat__list_candidate_tasks first.",
        );
    });

    it("이미 접두사가 붙은 이름을 두 번 감싸지 않는다", () => {
        const once = withMcpToolPrefix("Call search_tasks.", ["search_tasks"], "monitor-chat");

        expect(withMcpToolPrefix(once, ["search_tasks"], "monitor-chat")).toBe(once);
    });

    it("더 긴 이름의 앞부분과 겹치는 이름을 잘라 먹지 않는다", () => {
        expect(withMcpToolPrefix("get_task_events", ["get_task"], "monitor-chat")).toBe("get_task_events");
    });
});

describe("stripMcpToolPrefix", () => {
    it("서버 접두사를 벗겨 계약 이름으로 되돌린다", () => {
        expect(stripMcpToolPrefix(mcpToolName("monitor-chat", "search_tasks"))).toBe("search_tasks");
    });

    it("밑줄이 든 도구 이름을 잘라 먹지 않는다", () => {
        expect(stripMcpToolPrefix("mcp__monitor-chat__list_cleanup_suggestions")).toBe(
            "list_cleanup_suggestions",
        );
    });

    it("접두사가 없는 이름은 그대로 둔다", () => {
        expect(stripMcpToolPrefix("search_tasks")).toBe("search_tasks");
        expect(stripMcpToolPrefix("Bash")).toBe("Bash");
    });
});
