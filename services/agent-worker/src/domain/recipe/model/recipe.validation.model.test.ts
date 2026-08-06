import { describe, expect, it } from "vitest";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { readAgentCases } from "~agent-worker/support/contract.js";
import type { ProvenanceSnapshot } from "./recipe.provenance.model.js";
import type { RecipeCandidatePayload, RecipeSlicePayload } from "./recipe.scan.schema.js";
import { validateRecipeCandidates } from "./recipe.validation.model.js";

const CONTRACT = readAgentCases<{
    cases: {
        readonly anchorTaskId: string;
        readonly provenance: ProvenanceSnapshot;
        readonly candidateDefaults: RecipeCandidatePayload;
    };
}>(AGENT.recipeScan.id).cases;

const ANCHOR_WITHOUT_EVENTS = "The anchor contributing slice must cite at least one anchor event ID.";

function withSlices(slices: readonly RecipeSlicePayload[]): readonly RecipeCandidatePayload[] {
    return [{ ...CONTRACT.candidateDefaults, contributing_slices: [...slices] }];
}

function errorsFor(slices: readonly RecipeSlicePayload[]): readonly string[] {
    return validateRecipeCandidates(withSlices(slices), CONTRACT.anchorTaskId, CONTRACT.provenance);
}

describe("앵커 조각이 여럿인 후보", () => {
    it("앵커 이벤트를 뒤 조각이 인용해도 통과한다", () => {
        const errors = errorsFor([
            { taskId: CONTRACT.anchorTaskId, turnIds: [], eventIds: [] },
            { taskId: CONTRACT.anchorTaskId, turnIds: [], eventIds: ["event-1"] },
        ]);

        expect(errors).toEqual([]);
    });

    it("앵커 조각이 모두 이벤트를 인용하지 않으면 거부한다", () => {
        const errors = errorsFor([
            { taskId: CONTRACT.anchorTaskId, turnIds: [], eventIds: [] },
            { taskId: CONTRACT.anchorTaskId, turnIds: [], eventIds: [] },
            { taskId: "task-2", turnIds: [], eventIds: ["event-3"] },
        ]);

        expect(errors).toContain(`Recipe 1: ${ANCHOR_WITHOUT_EVENTS}`);
    });

    it("앵커 조각이 하나뿐이면 그 조각의 인용만으로 판정한다", () => {
        expect(errorsFor([{ taskId: CONTRACT.anchorTaskId, turnIds: [], eventIds: ["event-1"] }])).toEqual([]);
        expect(errorsFor([{ taskId: CONTRACT.anchorTaskId, turnIds: [], eventIds: [] }])).toContain(
            `Recipe 1: ${ANCHOR_WITHOUT_EVENTS}`,
        );
    });
});
