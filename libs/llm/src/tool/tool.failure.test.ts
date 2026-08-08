import { describe, expect, it } from "vitest";
import { ToolArgumentsMissingError, toolFailureText } from "./tool.failure.js";

const TEXTS = {
    toolFailed: "Tool {tool} failed: {reason}. Do not call it again more than once.",
    argumentsMissing: "Tool {tool} needs {missing} when action is {action}. Call it again with those arguments.",
};

describe("도구 실패를 모델이 읽는 문장", () => {
    it("실패한 도구의 이름과 사유를 담는다", () => {
        expect(toolFailureText(TEXTS, "read_task", new Error("upstream said no"))).toBe(
            "Tool read_task failed: upstream said no. Do not call it again more than once.",
        );
    });

    it("오류가 아닌 값도 사유로 옮긴다", () => {
        expect(toolFailureText(TEXTS, "read_task", "끊겼다")).toContain("끊겼다");
    });
});

describe("빠진 인자를 알리는 문장", () => {
    it("무엇이 어느 action 에 필요한지 담는다", () => {
        const text = toolFailureText(TEXTS, "propose_memo_write", new ToolArgumentsMissingError("create", ["taskId", "body"]));

        expect(text).toBe("Tool propose_memo_write needs taskId, body when action is create. Call it again with those arguments.");
    });

    it("고칠 수 있는 실수이므로 다시 부르지 말라고 말하지 않는다", () => {
        const text = toolFailureText(TEXTS, "propose_memo_write", new ToolArgumentsMissingError("create", ["taskId"]));

        expect(text).not.toContain("Do not call it again");
        expect(text).toContain("Call it again");
    });

    it("계약이 그 문구를 갖지 않으면 실패 문장으로 물러선다", () => {
        const text = toolFailureText({ toolFailed: TEXTS.toolFailed }, "propose_memo_write", new ToolArgumentsMissingError("create", ["taskId"]));

        expect(text).toContain("Tool propose_memo_write failed");
    });
});
