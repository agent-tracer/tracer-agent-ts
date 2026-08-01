import { describe, expect, it } from "vitest";
import { readContractEnum } from "~llm/support/contract.js";
import { AGENT_AXIS, AGENT_BACKEND } from "./agent.axis.js";

const DECLARED_AXIS = readContractEnum("AgentAxis");

describe("실행 축의 어휘", () => {
    it("계약이 선언한 축의 목록과 같은 이름을 안다", () => {
        expect(Object.values(AGENT_AXIS)).toEqual(DECLARED_AXIS);
    });

    it("이 이미지가 원장과 관측에 남기는 축은 계약이 선언한 값이다", () => {
        expect(DECLARED_AXIS).toContain(AGENT_BACKEND);
    });
});
