import { describe, expect, it } from "vitest";
import type { InspectAssignment } from "~agent-worker/domain/cleanup/model/cleanup.dispatch.schema.js";
import { oneInspectPerTask } from "./cleanup.sdk.orchestration.js";

function assignment(taskId: string, depth: InspectAssignment["depth"] = "shallow"): InspectAssignment {
    return { taskId, depth };
}

describe("한 실행이 조사할 태스크 명단", () => {
    it("태스크가 서로 다르면 모두 조사한다", () => {
        const kept = oneInspectPerTask([assignment("task-1"), assignment("task-2")]);

        expect(kept.map(({ taskId }) => taskId)).toEqual(["task-1", "task-2"]);
    });

    it("모델이 같은 태스크를 겹쳐 내면 먼저 적은 것만 남긴다", () => {
        const kept = oneInspectPerTask([assignment("task-1", "deep"), assignment("task-1", "shallow")]);

        expect(kept).toHaveLength(1);
        expect(kept[0]?.depth).toBe("deep");
    });

    it("겹친 태스크를 걸러도 다른 태스크는 그대로 남긴다", () => {
        const kept = oneInspectPerTask([
            assignment("task-1"),
            assignment("task-2"),
            assignment("task-1"),
        ]);

        expect(kept.map(({ taskId }) => taskId)).toEqual(["task-1", "task-2"]);
    });

    it("빈 명단은 그대로 빈 채로 낸다", () => {
        expect(oneInspectPerTask([])).toEqual([]);
    });
});
