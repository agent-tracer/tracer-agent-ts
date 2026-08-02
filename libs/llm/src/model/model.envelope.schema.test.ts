import { describe, expect, it } from "vitest";
import { assertModelEnvelopeVocabulary } from "./model.envelope.schema.js";

describe("모델 봉투 어휘", () => {
    it("effort와 thinking 값이 계약과 같으면 조용히 지난다", () => {
        expect(() => assertModelEnvelopeVocabulary()).not.toThrow();
    });
});
