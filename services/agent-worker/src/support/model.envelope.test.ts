import { describe, expect, it } from "vitest";
import { readContractJson } from "~agent-worker/support/contract.js";
import { modelEnvelopeOf } from "~agent-worker/support/model.envelope.js";

interface DeclaredSharedBudget {
    readonly sharedOutputBudget: { readonly appliesTo: readonly string[] };
}

const SHARED = readContractJson<DeclaredSharedBudget>("agent/shared/model.envelope.json")
    .sharedOutputBudget.appliesTo;

describe("모델 단위의 실행 봉투", () => {
    // 이 덮어쓰기의 유일한 근거가 출력 예산을 나눠 쓰는 성질이므로 그 목록 밖의 모델은 덮이지 않는다.
    it.each(SHARED)("%s 는 출력 예산을 나눠 쓰므로 계약이 덮어 적은 값을 받는다", (model) => {
        expect(modelEnvelopeOf(model).maxOutputTokens).toBeGreaterThan(0);
    });

    it("그 목록에 없는 모델은 아무것도 덮지 않는다", () => {
        expect(modelEnvelopeOf("claude-haiku-4-5")).toEqual({});
    });

    it("계약이 모르는 이름에도 빈 값을 낸다", () => {
        expect(modelEnvelopeOf("gpt-4")).toEqual({});
    });
});
