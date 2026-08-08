import { describe, expect, it } from "vitest";
import type { ProbeAssignment } from "~agent-worker/domain/recipe/model/recipe.dispatch.schema.js";
import { oneProbePerAxis } from "./recipe.sdk.orchestration.js";

function assignment(probe: string, question: string): ProbeAssignment {
    return { probe, depth: "shallow", question } as ProbeAssignment;
}

describe("한 라운드가 세우는 전문가 명단", () => {
    it("축이 서로 다르면 모두 세운다", () => {
        const kept = oneProbePerAxis([assignment("web", "무엇을"), assignment("code", "어디서")], 0);

        expect(kept.map(({ probe }) => probe)).toEqual(["web", "code"]);
    });

    it("모델이 같은 축을 겹쳐 내면 먼저 적은 것만 남긴다", () => {
        const kept = oneProbePerAxis(
            [assignment("web", "먼저 물은 것"), assignment("web", "겹쳐 물은 것")],
            1,
        );

        expect(kept).toHaveLength(1);
        expect(kept[0]?.question).toBe("먼저 물은 것");
    });

    it("겹친 축을 걸러도 다른 축은 그대로 남긴다", () => {
        const kept = oneProbePerAxis(
            [assignment("web", "가"), assignment("code", "나"), assignment("web", "다")],
            0,
        );

        expect(kept.map(({ probe }) => probe)).toEqual(["web", "code"]);
    });

    it("빈 명단은 그대로 빈 채로 낸다", () => {
        expect(oneProbePerAxis([], 0)).toEqual([]);
    });
});
