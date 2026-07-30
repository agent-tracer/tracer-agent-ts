import { describe, expect, it, vi } from "vitest";
import type { CancelExperimentUseCase } from "~agent-api/domain/evaluation/application/command/cancel.experiment.usecase.js";
import type { CreateExperimentUseCase } from "~agent-api/domain/evaluation/application/command/create.experiment.usecase.js";
import type { StartExperimentUseCase } from "~agent-api/domain/evaluation/application/command/start.experiment.usecase.js";
import type { GetExperimentComparisonUseCase } from "~agent-api/domain/evaluation/application/query/get.experiment.comparison.usecase.js";
import type { GetExperimentUseCase } from "~agent-api/domain/evaluation/application/query/get.experiment.usecase.js";
import type { ListExperimentExecutionsUseCase } from "~agent-api/domain/evaluation/application/query/list.experiment.executions.usecase.js";
import type { ListExperimentsUseCase } from "~agent-api/domain/evaluation/application/query/list.experiments.usecase.js";
import type { PreviewExperimentUseCase } from "~agent-api/domain/evaluation/application/query/preview.experiment.usecase.js";
import { EvaluationExperimentController } from "./evaluation.experiment.controller.js";
import { createExperimentSchema, startExperimentSchema } from "./experiment.schema.js";

const VARIANT = {
    name: "baseline", baseline: true, backend: "claude-sdk", agentName: "title-suggestion",
    toolContractVersion: "1",
};
const CREATE_BODY = {
    datasetId: "dataset-1", datasetRevision: 1, evaluatorSetVersion: "default-v1",
    maxBudgetUsd: 1, repetitions: 1,
    variants: [VARIANT, { ...VARIANT, name: "candidate", baseline: false }],
};
const CONFIRMATION = { executionCount: 4, maxBudgetUsd: 1, fingerprint: "experiment-1:1" };

function controller() {
    const spies = {
        list: vi.fn(), create: vi.fn(), get: vi.fn(), preview: vi.fn(),
        executions: vi.fn(), compare: vi.fn(), start: vi.fn(), cancel: vi.fn(),
    };
    const asUseCase = <T>(execute: unknown) => ({ execute }) as unknown as T;
    return {
        ...spies,
        instance: new EvaluationExperimentController(
            asUseCase<ListExperimentsUseCase>(spies.list),
            asUseCase<CreateExperimentUseCase>(spies.create),
            asUseCase<GetExperimentUseCase>(spies.get),
            asUseCase<PreviewExperimentUseCase>(spies.preview),
            asUseCase<ListExperimentExecutionsUseCase>(spies.executions),
            asUseCase<GetExperimentComparisonUseCase>(spies.compare),
            asUseCase<StartExperimentUseCase>(spies.start),
            asUseCase<CancelExperimentUseCase>(spies.cancel),
        ),
    };
}

describe("EvaluationExperimentController", () => {
    it("자기신고 사용자로 실험 목록을 조회한다", async () => {
        const { instance, list } = controller();
        await instance.list("u1");
        expect(list).toHaveBeenCalledWith("u1");
    });

    it("자기신고 헤더가 비면 실험 목록이 기본 사용자로 간다", async () => {
        const { instance, list } = controller();
        await instance.list(undefined);
        expect(list).toHaveBeenCalledWith("local");
    });

    it("초안 본문에 자기신고 사용자를 붙여 생성 유스케이스에 넘긴다", async () => {
        const { instance, create } = controller();
        await instance.create("u1", createExperimentSchema.parse(CREATE_BODY));
        expect(create).toHaveBeenCalledWith({ userId: "u1", ...CREATE_BODY });
    });

    it("변형이 둘 미만인 초안을 거절한다", () => {
        expect(() => createExperimentSchema.parse({ ...CREATE_BODY, variants: [VARIANT] })).toThrow();
    });

    it("본문에 없는 칸을 실은 초안을 거절한다", () => {
        expect(() => createExperimentSchema.parse({ ...CREATE_BODY, userId: "u1" })).toThrow();
    });

    it("예산이 0 이하인 초안을 거절한다", () => {
        expect(() => createExperimentSchema.parse({ ...CREATE_BODY, maxBudgetUsd: 0 })).toThrow();
    });

    it("경로의 실험을 상세와 예고와 실행과 비교 창구에 각각 넘긴다", async () => {
        const { instance, get, preview, executions, compare } = controller();
        await instance.get("u1", "experiment-1");
        await instance.preview("u1", "experiment-1");
        await instance.executions("u1", "experiment-1");
        await instance.compare("u1", "experiment-1");
        for (const spy of [get, preview, executions, compare]) {
            expect(spy).toHaveBeenCalledWith("u1", "experiment-1");
        }
    });

    it("확인 값을 벗겨 시작 유스케이스에 넘긴다", async () => {
        const { instance, start } = controller();
        await instance.start("u1", "experiment-1", startExperimentSchema.parse({ confirmation: CONFIRMATION }));
        expect(start).toHaveBeenCalledWith("u1", "experiment-1", CONFIRMATION);
    });

    it("지문이 빠진 확인으로는 실험을 시작하지 않는다", () => {
        const { fingerprint: _fingerprint, ...rest } = CONFIRMATION;
        expect(() => startExperimentSchema.parse({ confirmation: rest })).toThrow();
    });

    it("경로의 실험을 중단 유스케이스에 넘긴다", async () => {
        const { instance, cancel } = controller();
        await instance.cancel("u1", "experiment-1");
        expect(cancel).toHaveBeenCalledWith("u1", "experiment-1");
    });
});
