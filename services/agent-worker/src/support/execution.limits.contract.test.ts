import { describe, expect, it } from "vitest";
import { featureLimits, featureModels } from "@tracer-agent/llm";
import { readContractJson } from "~agent-worker/support/contract.js";

/** 계약이 한 종류에 적은 실행 한도이며 적지 않은 칸은 그 종류가 그 칸을 쓰지 않는다는 뜻이다. */
interface DeclaredLimits {
    readonly defaultModel: string;
    readonly fallbackModel?: string;
    readonly budgetUsd: number;
    readonly maxTurns: number;
    readonly maxOutputTokens: number;
    readonly deadlineMs: number;
    readonly stallMs?: number;
    readonly allowedModels: readonly string[];
}

const DECLARED = readContractJson<{ readonly kinds: Readonly<Record<string, DeclaredLimits>> }>(
    "agent/shared/execution.limits.json",
).kinds;

const KINDS = Object.entries(DECLARED).map(([kind, declared]) => ({ kind, declared }));

describe("계약이 소유한 실행 한도", () => {
    it.each(KINDS)("$kind 의 예산과 턴과 출력과 마감이 계약이 적은 값과 같다", ({ kind, declared }) => {
        const limits = featureLimits(kind);

        expect({
            budgetUsd: limits.budgetUsd,
            maxTurns: limits.maxTurns,
            maxOutputTokens: limits.maxOutputTokens,
            deadlineMs: limits.deadlineMs,
        }).toEqual({
            budgetUsd: declared.budgetUsd,
            maxTurns: declared.maxTurns,
            maxOutputTokens: declared.maxOutputTokens,
            deadlineMs: declared.deadlineMs,
        });
    });

    it.each(KINDS)("$kind 의 기본 모델과 대체 모델이 계약이 적은 값과 같다", ({ kind, declared }) => {
        const models = featureModels(kind);

        expect({ defaultModel: models?.default, fallbackModel: models?.fallback }).toEqual({
            defaultModel: declared.defaultModel,
            fallbackModel: declared.fallbackModel,
        });
    });

    // 허용 목록과 예산은 한 쌍이라 이 축만 목록을 넓히면 같은 예산으로 더 비싼 모델을 실행한다.
    it.each(KINDS)("$kind 가 쓸 수 있는 모델이 계약이 적은 목록과 같다", ({ kind, declared }) => {
        expect(featureModels(kind)?.allowed).toEqual(declared.allowedModels);
    });

    // 추론 노력은 이제 종류가 아니라 모델에 붙으므로 이 자리는 침묵 상한만 본다.
    it.each(KINDS)("$kind 가 계약에 없는 침묵 상한을 더 갖지 않는다", ({ kind, declared }) => {
        expect(featureLimits(kind).stallMs).toBe(declared.stallMs);
    });
});
