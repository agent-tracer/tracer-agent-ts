import { describe, expect, it } from "vitest";
import { z } from "zod";
import { contractArgSchema, type ContractToolArg } from "./contract.tool.schema.js";

const ARG: ContractToolArg = {
    type: "string",
    required: true,
    trim: true,
    minLength: 1,
    maxLength: 8,
    description: "무엇이든 적는다. At most 8 characters.",
};

/** 모델이 받는 shape 은 zod 에서 나오므로 그 shape 이 상한을 갖는지가 실제로 걸리는지를 정한다. */
const SHAPE = z.object({ content: contractArgSchema(ARG) });

describe("계약이 도구 인자에 건 길이 상한", () => {
    it("상한만큼의 값을 통과시킨다", () => {
        expect(SHAPE.safeParse({ content: "가".repeat(8) }).success).toBe(true);
    });

    // 상한을 읽지 않으면 이 값도 통과하므로 여기가 그 칸이 실제로 걸리는 자리다.
    it("상한을 한 글자 넘긴 값을 거절한다", () => {
        expect(SHAPE.safeParse({ content: "가".repeat(9) }).success).toBe(false);
    });

    it("상한을 적지 않은 인자는 길이를 가리지 않는다", () => {
        const { maxLength: _dropped, ...unbounded } = ARG;

        expect(z.object({ content: contractArgSchema(unbounded) })
            .safeParse({ content: "가".repeat(9000) }).success).toBe(true);
    });
});
