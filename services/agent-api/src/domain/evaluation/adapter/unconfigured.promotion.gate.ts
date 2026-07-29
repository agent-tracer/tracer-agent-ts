import type { PromptPromotionGatePort } from "../port/prompt.runtime.port.js";

export class UnconfiguredPromotionGate implements PromptPromotionGatePort {
    evaluate() {
        return Promise.resolve({
            passed: false,
            policyVersion: "unconfigured",
            reasons: ["promotion gate is not configured"],
            evidence: {},
        });
    }
}
