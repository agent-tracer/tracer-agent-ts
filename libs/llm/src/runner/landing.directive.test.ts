import { describe, expect, it } from "vitest";
import { landingDirective } from "./landing.directive.js";

describe("landingDirective", () => {
    it("출력 스키마를 요구한 실행에만 구조화 출력을 요구한다", () => {
        const directive = landingDirective(true);

        expect(directive).toContain("structured output");
        expect(directive).toContain("Stop calling tools");
    });

    it("자유 텍스트로 끝나는 실행에는 존재하지 않는 형식을 요구하지 않는다", () => {
        const directive = landingDirective(false);

        // 대화는 구조화 출력을 내지 않으므로 이 문구가 새면 모델이 없는 형식을 만들어 낸다.
        expect(directive).not.toContain("structured");
        expect(directive).toContain("final answer");
        expect(directive).toContain("Stop calling tools");
    });
});
