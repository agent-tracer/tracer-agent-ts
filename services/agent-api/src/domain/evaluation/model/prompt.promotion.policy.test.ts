import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    evaluatePromotionGate, PROMOTION_GATE_POLICY, UNGATED_PROMOTION_CHANNELS,
} from "./prompt.promotion.policy.js";
import type { PromptChannel } from "./prompt.model.js";

interface FragmentRegistryContract {
    readonly promotionPath: readonly PromptChannel[];
    readonly promotionGate: {
        readonly policy: string;
        readonly ungatedChannels: readonly PromptChannel[];
    };
}

const registry = JSON.parse(
    readFileSync("contract/agent/shared/prompt.fragment.registry.json", "utf8"),
) as FragmentRegistryContract;

describe("승격 게이트 정책", () => {
    it("계약이 정한 게이트 이름을 그대로 안다", () => {
        expect(PROMOTION_GATE_POLICY).toBe(registry.promotionGate.policy);
    });

    it("계약이 게이트 없이 움직이라고 적은 채널만 게이트 없이 움직인다", () => {
        expect([...UNGATED_PROMOTION_CHANNELS].sort())
            .toStrictEqual([...registry.promotionGate.ungatedChannels].sort());
    });

    it.each(registry.promotionGate.ungatedChannels)("%s 로 가는 승격이 게이트 없이 지난다", (channel) => {
        expect(evaluatePromotionGate({ channel, versionId: "v1", stagingVersionId: null }).passed).toBe(true);
    });

    it("승격 경로의 마지막 채널만 게이트를 지난다", () => {
        const gated = registry.promotionPath
            .filter((channel) => !registry.promotionGate.ungatedChannels.includes(channel));
        expect(gated).toStrictEqual([registry.promotionPath[registry.promotionPath.length - 1]]);
        expect(evaluatePromotionGate({ channel: gated[0] as PromptChannel, versionId: "v1", stagingVersionId: null })
            .passed).toBe(false);
    });

    it("판정에 싣는 정책 이름이 계약의 게이트 이름을 담는다", () => {
        expect(evaluatePromotionGate({ channel: "production", versionId: "v1", stagingVersionId: "v1" }).policyVersion)
            .toContain(registry.promotionGate.policy);
    });
});

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
        expect(gate.policyVersion).toBe("staging-first/1");
    });
});
