import { describe, expect, it } from "vitest";
import { evaluatePromotionGate } from "./prompt.promotion.policy.js";

describe("evaluatePromotionGate", () => {
    it("candidate 로 가는 승격은 게이트 없이 지난다", () => {
        const gate = evaluatePromotionGate({ channel: "candidate", versionId: "v1", stagingVersionId: null });
        expect(gate.passed).toBe(true);
        expect(gate.reasons).toStrictEqual([]);
    });

    it("staging 으로 가는 승격은 게이트 없이 지난다", () => {
        expect(evaluatePromotionGate({ channel: "staging", versionId: "v1", stagingVersionId: null }).passed)
            .toBe(true);
    });

    it("staging 에 서 있던 판만 production 으로 지난다", () => {
        expect(evaluatePromotionGate({ channel: "production", versionId: "v1", stagingVersionId: "v1" }).passed)
            .toBe(true);
    });

    it("staging 을 지나지 않은 판은 production 으로 가지 못한다", () => {
        const gate = evaluatePromotionGate({ channel: "production", versionId: "v2", stagingVersionId: "v1" });
        expect(gate.passed).toBe(false);
        expect(gate.reasons).toStrictEqual(["the version has not stood on the staging channel"]);
    });

    it("staging 채널이 비어 있으면 production 으로 가지 못한다", () => {
        expect(evaluatePromotionGate({ channel: "production", versionId: "v1", stagingVersionId: null }).passed)
            .toBe(false);
    });

    it("판정마다 채널과 두 판 식별자를 근거로 싣는다", () => {
        const gate = evaluatePromotionGate({ channel: "production", versionId: "v2", stagingVersionId: "v1" });
        expect(gate.evidence).toStrictEqual({ channel: "production", versionId: "v2", stagingVersionId: "v1" });
        expect(gate.policyVersion).toBe("promotion-path/1");
    });
});
