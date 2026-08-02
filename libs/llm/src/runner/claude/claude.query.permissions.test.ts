import { describe, expect, it } from "vitest";
import {
    buildQueryPermissions,
    DENIED_BUILT_IN_TOOLS,
    LOCKED_PERMISSION_MODE,
} from "./claude.query.permissions.js";

describe("도구 표면", () => {
    it("사전 승인 목록 밖의 도구를 프롬프트 없이 거절하는 모드를 고른다", () => {
        expect(buildQueryPermissions([]).permissionMode).toBe("dontAsk");
        expect(LOCKED_PERMISSION_MODE).toBe("dontAsk");
    });

    it("셸과 파일 쓰기와 위임 도구를 선언에서 지운다", () => {
        const { disallowedTools } = buildQueryPermissions(["mcp__monitor-chat__get_task"]);
        expect(disallowedTools).toEqual(expect.arrayContaining(["Bash", "Write", "Edit", "Agent"]));
    });

    it("호출자가 연 도구는 거절 목록에 넣지 않는다", () => {
        const { allowedTools, disallowedTools } = buildQueryPermissions(["Bash"]);
        expect(allowedTools).toContain("Bash");
        expect(disallowedTools).not.toContain("Bash");
    });

    it("이 실행만 추가로 막을 도구를 거절 목록에 더한다", () => {
        const { disallowedTools } = buildQueryPermissions([], ["mcp__monitor-chat__remember_fact"]);
        expect(disallowedTools).toContain("mcp__monitor-chat__remember_fact");
    });

    it("같은 이름을 두 번 싣지 않는다", () => {
        const { disallowedTools } = buildQueryPermissions([], ["Bash"]);
        expect(disallowedTools.filter((name) => name === "Bash")).toHaveLength(1);
    });

    it("빌트인 거절 목록이 비어 있지 않다", () => {
        expect(DENIED_BUILT_IN_TOOLS.length).toBeGreaterThan(0);
    });
});
