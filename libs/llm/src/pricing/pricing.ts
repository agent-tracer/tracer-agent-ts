import type { AgentQueryUsage } from "~llm/model/agent.usage.js";
import { isPricedModel, modelAlias, modelRate, type ModelRate } from "./llm.catalog.schema.js";

export type { ModelRate } from "./llm.catalog.schema.js";

/** 단가를 모르는 모델은 예산을 집행할 수 없으므로 집행 가능 여부를 먼저 묻는다. */
export function canEstimateCost(model: string): boolean {
    return isPricedModel(model);
}

/** 모델이나 사용량을 모르면 오도하지 않도록 null을 낸다. */
/** 시도 이력과 지표가 같은 이름을 쓰도록 프로바이더가 답한 판까지 붙은 이름을 별칭으로 되돌린다. */
export function resolveModelAlias(model: string): string {
    return modelAlias(model) ?? model;
}

export function estimateCostUsd(model: string, usage: AgentQueryUsage | null): number | null {
    const rate: ModelRate | null = modelRate(model);
    if (rate === null || usage === null) return null;
    const cost =
        (usage.inputTokens * rate.input
            + usage.outputTokens * rate.output
            + usage.cacheCreationTokens * rate.cacheWrite
            + usage.cacheReadTokens * rate.cacheRead)
        / 1_000_000;
    return Math.round(cost * 1_000_000) / 1_000_000;
}
