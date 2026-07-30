import type { PromptChannel } from "~agent-api/domain/evaluation/model/prompt.model.js";

/** 승격이 채널을 움직여도 되는지의 판정이며 원장이 이 값을 그대로 근거로 싣는다. */
export interface PromotionGateResult {
    readonly passed: boolean;
    readonly policyVersion: string;
    readonly reasons: readonly string[];
    readonly evidence: Readonly<Record<string, unknown>>;
}

/** 승격 게이트가 무엇을 보는지의 이름이며 값은 계약의 조각 레지스트리 선언이 소유한다. */
export const PROMOTION_GATE_POLICY = "staging-first";

/** 게이트 없이 움직이는 채널이며 값은 계약의 조각 레지스트리 선언이 소유한다. */
export const UNGATED_PROMOTION_CHANNELS: readonly PromptChannel[] = ["candidate", "staging"];

const POLICY_VERSION = `${PROMOTION_GATE_POLICY}/1`;

/**
 * 계약의 promotionPath 가 candidate → staging → production 을 선언하므로 production 으로 가는 판은
 * staging 채널에 서 있던 판이어야 하며, 실행에 쓰이지 않는 candidate 와 개발자 기계만 보는 staging 은
 * 게이트 없이 움직인다.
 */
export function evaluatePromotionGate(input: {
    readonly channel: PromptChannel;
    readonly versionId: string;
    readonly stagingVersionId: string | null;
}): PromotionGateResult {
    const evidence = { channel: input.channel, versionId: input.versionId, stagingVersionId: input.stagingVersionId };
    if (UNGATED_PROMOTION_CHANNELS.includes(input.channel)) {
        return { passed: true, policyVersion: POLICY_VERSION, reasons: [], evidence };
    }
    const passed = input.stagingVersionId === input.versionId;
    return {
        passed,
        policyVersion: POLICY_VERSION,
        reasons: passed ? [] : ["the version has not stood on the staging channel"],
        evidence,
    };
}
