import { describe, expect, it } from "vitest";
import { messageOf } from "./failure.message.js";

describe("사용자에게 보일 실패 문구", () => {
    it("감싸이지 않은 오류는 그 문구를 그대로 낸다", () => {
        expect(messageOf(new Error("모델이 응답하지 않았다"))).toBe("모델이 응답하지 않았다");
    });

    it("오케스트레이션이 감싼 오류에서 맨 안쪽 원인을 꺼낸다", () => {
        const inner = new Error("설정에 모델 자격이 없다");
        const wrapped = new Error("Activity task failed", { cause: inner });

        expect(messageOf(wrapped)).toBe("설정에 모델 자격이 없다");
    });

    it("여러 겹으로 감싸여도 맨 안쪽까지 파고든다", () => {
        const root = new Error("스레드가 이미 바쁘다");
        const middle = new Error("Activity task failed", { cause: root });
        const outer = new Error("Workflow task failed", { cause: middle });

        expect(messageOf(outer)).toBe("스레드가 이미 바쁘다");
    });

    it("맨 안쪽이 빈 문구면 겉의 문구라도 남겨 빈 실패를 만들지 않는다", () => {
        const inner = new Error("");
        const wrapped = new Error("Activity task failed", { cause: inner });

        expect(messageOf(wrapped)).toBe("Activity task failed");
    });

    it("원인이 오류가 아니면 거기서 멈춘다", () => {
        const wrapped = new Error("겉의 문구", { cause: "문자열 원인" });

        expect(messageOf(wrapped)).toBe("겉의 문구");
    });

    it("오류가 아닌 값도 문구로 바꾼다", () => {
        expect(messageOf("그냥 문자열")).toBe("그냥 문자열");
    });
});
