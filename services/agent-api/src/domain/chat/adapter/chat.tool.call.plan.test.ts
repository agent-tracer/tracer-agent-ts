import { describe, expect, it } from "vitest";
import { chatToolCallPlan } from "./chat.tool.call.plan.js";
import { CHAT_MUTATION_TOOLS } from "~agent-api/domain/chat/model/chat.tool.schema.js";

describe("승인 뒤 부를 자리", () => {
    it("확인 게이트가 필요한 도구를 빠짐없이 잇는다", () => {
        expect(Object.keys(chatToolCallPlan).sort()).toEqual([...CHAT_MUTATION_TOOLS].sort());
    });

    it("바꾼 자리만 실어 보내고 그 사실을 문장으로 남긴다", () => {
        const call = chatToolCallPlan["update_task"]!({ taskId: "t1", title: "제목" });

        expect(call.args).toEqual({ taskId: "t1", title: "제목" });
        expect(call.describe(null)).toBe(`Updated task t1: title="제목".`);
    });

    it("바꿀 것이 없는 갱신을 거절한다", () => {
        expect(() => chatToolCallPlan["update_task"]!({ taskId: "t1" }))
            .toThrow("update_task needs title or status");
    });

    it("필수 인자가 없으면 거절한다", () => {
        expect(() => chatToolCallPlan["archive_task"]!({})).toThrow("taskId is required");
    });

    it("객체로 온 기대를 그대로 실어 보낸다", () => {
        const call = chatToolCallPlan["create_rule"]!({
            taskId: "t1",
            anchorEventId: "e1",
            name: "규칙",
            expectation: { must: ["빌드가 통과한다"] },
        });

        expect(call.args["expectation"]).toEqual({ must: ["빌드가 통과한다"] });
    });

    it("객체가 아닌 기대를 거절한다", () => {
        expect(() => chatToolCallPlan["create_rule"]!({
            taskId: "t1", anchorEventId: "e1", name: "규칙", expectation: "그냥 문장",
        })).toThrow("expectation must be a JSON object");
    });

    it("태그 목록을 배열로 받고 빈 이름을 걸러 낸다", () => {
        expect(chatToolCallPlan["set_task_tags"]!({ taskId: "t1", tagIds: ["a", "", "b"] }).args["tagIds"])
            .toEqual(["a", "b"]);
    });

    it("배열이 아닌 태그 목록을 거절한다", () => {
        expect(() => chatToolCallPlan["set_task_tags"]!({ taskId: "t1", tagIds: "a, b" }))
            .toThrow("tagIds must be a JSON array");
    });

    it("응답에 실린 수를 문장에 옮긴다", () => {
        expect(chatToolCallPlan["approve_rule"]!({ ruleId: "r1" }).describe({ reevaluated: 3 }))
            .toBe("Approved rule r1 and reevaluated 3 event(s).");
    });

    it("접수한 잡의 식별자와 상태를 문장에 옮긴다", () => {
        const call = chatToolCallPlan["enqueue_job"]!({ kind: "title.suggestion", input: { taskId: "t1" } });

        expect(call.args).toEqual({ kind: "title.suggestion", input: { taskId: "t1" } });
        expect(call.describe({ job: { id: "j1", status: "pending" } }))
            .toBe("Enqueued title.suggestion job j1 (status: pending).");
    });
});
