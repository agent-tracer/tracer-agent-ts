import { readContractJson } from "~agent-worker/support/contract.js";

/** 한 모델이 어느 종류에서 실행되든 갖는 출력 한도와 추론 노력이다. */
export interface ModelEnvelope {
    readonly maxOutputTokens?: number;
    readonly effort?: "low" | "medium" | "high" | "xhigh" | "max";
}

const PROSE = new Set(["meaning", "appliesToReason"]);

const DECLARED: Readonly<Record<string, ModelEnvelope>> = Object.fromEntries(
    Object.entries(
        readContractJson<{ readonly modelEnvelope: Readonly<Record<string, unknown>> }>(
            "agent/shared/execution.limits.json",
        ).modelEnvelope,
    ).filter(([name]) => !PROSE.has(name)),
) as Readonly<Record<string, ModelEnvelope>>;

/** 계약이 이 모델에 덮어 적은 값이며 적지 않은 모델은 종류의 기본 한도를 그대로 쓴다. */
export function modelEnvelopeOf(model: string): ModelEnvelope {
    return DECLARED[model] ?? {};
}
