import { describe, expect, it, vi } from "vitest";
import type { DrawReviewPairUseCase } from "~agent-api/domain/evaluation/application/command/draw.review.pair.usecase.js";
import type { SubmitReviewUseCase } from "~agent-api/domain/evaluation/application/command/submit.review.usecase.js";
import type { ListReviewsUseCase } from "~agent-api/domain/evaluation/application/query/list.reviews.usecase.js";
import { EvaluationReviewController } from "./evaluation.review.controller.js";
import { submitReviewSchema } from "./experiment.schema.js";

const SUBMISSION = { executionAId: "execution-1", executionBId: "execution-2", preference: "a" };

function controller() {
    const spies = { list: vi.fn(), next: vi.fn(), submit: vi.fn() };
    const asUseCase = <T>(execute: unknown) => ({ execute }) as unknown as T;
    return {
        ...spies,
        instance: new EvaluationReviewController(
            asUseCase<ListReviewsUseCase>(spies.list),
            asUseCase<DrawReviewPairUseCase>(spies.next),
            asUseCase<SubmitReviewUseCase>(spies.submit),
        ),
    };
}

describe("EvaluationReviewController", () => {
    it("경로의 실험으로 검토 목록을 조회한다", async () => {
        const { instance, list } = controller();
        await instance.list("u1", "experiment-1");
        expect(list).toHaveBeenCalledWith("u1", "experiment-1");
    });

    it("자기신고 헤더가 비면 검토 목록이 기본 사용자로 간다", async () => {
        const { instance, list } = controller();
        await instance.list(undefined, "experiment-1");
        expect(list).toHaveBeenCalledWith("local", "experiment-1");
    });

    it("아직 검토하지 않은 짝을 뽑는 유스케이스에 실험을 넘긴다", async () => {
        const { instance, next } = controller();
        await instance.next("u1", "experiment-1");
        expect(next).toHaveBeenCalledWith("u1", "experiment-1");
    });

    it("사유와 교정 출력이 없는 제출을 null 로 채워 넘긴다", async () => {
        const { instance, submit } = controller();
        await instance.submit("u1", "experiment-1", submitReviewSchema.parse(SUBMISSION));
        expect(submit).toHaveBeenCalledWith({
            userId: "u1", experimentId: "experiment-1", executionAId: "execution-1",
            executionBId: "execution-2", preference: "a", reason: null, correctedOutput: null,
        });
    });

    it("계약이 선언하지 않은 선호로는 검토를 제출하지 않는다", () => {
        expect(() => submitReviewSchema.parse({ ...SUBMISSION, preference: "reject" })).toThrow();
    });

    it("본문에 없는 칸을 실은 제출을 거절한다", () => {
        expect(() => submitReviewSchema.parse({ ...SUBMISSION, experimentId: "experiment-1" })).toThrow();
    });
});
