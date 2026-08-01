import { describe, expect, it } from "vitest";
import { readContractFields } from "~agent-api/support/contract.js";
import { CancelExperimentUseCase } from "../application/command/cancel.experiment.usecase.js";
import { CreateExperimentUseCase } from "../application/command/create.experiment.usecase.js";
import { DrawReviewPairUseCase } from "../application/command/draw.review.pair.usecase.js";
import { StartExperimentUseCase } from "../application/command/start.experiment.usecase.js";
import { SubmitReviewUseCase } from "../application/command/submit.review.usecase.js";
import { GetExperimentComparisonUseCase } from "../application/query/get.experiment.comparison.usecase.js";
import { GetExperimentUseCase } from "../application/query/get.experiment.usecase.js";
import { ListExperimentExecutionsUseCase } from "../application/query/list.experiment.executions.usecase.js";
import { ListExperimentsUseCase } from "../application/query/list.experiments.usecase.js";
import { ListReviewsUseCase } from "../application/query/list.reviews.usecase.js";
import { PreviewExperimentUseCase } from "../application/query/preview.experiment.usecase.js";
import { EXPERIMENT_NOW, aScore, aVariant, anExecution, anExperiment, experimentHarness } from "../application/experiment.test.fixture.js";
import { FirstChoiceRandom, FixedExperimentClock, RecordingExperimentDispatcher, SequentialExperimentIdGenerator } from "../port/__fakes__/experiment.support.fakes.js";
import { EvaluationExperimentController } from "./evaluation.experiment.controller.js";
import { EvaluationReviewController } from "./evaluation.review.controller.js";
import { createExperimentSchema, startExperimentSchema, submitReviewSchema } from "./experiment.schema.js";
import { SequentialEvaluationIdGenerator } from "~agent-api/domain/evaluation/port/__fakes__/sequential.evaluation.id.generator.js";

const USER = "user-1";
const EXPERIMENT = "experiment-1";

/** 창구가 낸 값의 칸이 계약이 선언한 칸과 정확히 같은지, 필수 칸이 빠지지 않았는지 본다. */
function expectContractFields(value: unknown, schemaName: string) {
    const { declared, required } = readContractFields(schemaName);
    const emitted = Object.keys(value as Record<string, unknown>);
    expect(emitted.filter((field) => !declared.includes(field)), `${schemaName} 가 선언하지 않은 칸`).toEqual([]);
    expect(required.filter((field) => !emitted.includes(field)), `${schemaName} 가 요구하는 칸`).toEqual([]);
}

function surface() {
    const { repository } = experimentHarness();
    const ids = new SequentialExperimentIdGenerator();
    const clock = new FixedExperimentClock(EXPERIMENT_NOW);
    const dispatcher = new RecordingExperimentDispatcher();
    const experiments = new EvaluationExperimentController(
        new ListExperimentsUseCase(repository),
        new CreateExperimentUseCase(repository, ids, clock),
        new GetExperimentUseCase(repository),
        new PreviewExperimentUseCase(repository),
        new ListExperimentExecutionsUseCase(repository),
        new GetExperimentComparisonUseCase(repository),
        new StartExperimentUseCase(repository, dispatcher, new SequentialEvaluationIdGenerator()),
        new CancelExperimentUseCase(repository, dispatcher, clock),
    );
    const reviews = new EvaluationReviewController(
        new ListReviewsUseCase(repository),
        new DrawReviewPairUseCase(repository, new FirstChoiceRandom()),
        new SubmitReviewUseCase(repository, ids, clock),
    );
    return { repository, experiments, reviews, dispatcher };
}

function seeded() {
    const harness = surface();
    harness.repository.experiments.push(anExperiment());
    harness.repository.variants.push(aVariant(), aVariant({ id: "variant-2", name: "candidate", baseline: false }));
    harness.repository.examples.push({ id: "example-1" });
    harness.repository.executions.push(
        anExecution(),
        anExecution({ id: "execution-2", variantId: "variant-2", output: { answer: "다른 값" } }),
    );
    harness.repository.scores.push(aScore());
    return harness;
}

const CREATE_BODY = createExperimentSchema.parse({
    datasetId: "dataset-1", datasetRevision: 1, evaluatorSetVersion: "default-v1",
    maxBudgetUsd: 1, repetitions: 1,
    variants: [
        { name: "baseline", baseline: true, backend: "claude-sdk", agentName: "title-suggestion", toolContractVersion: "1" },
        { name: "candidate", baseline: false, backend: "claude-sdk", agentName: "title-suggestion", toolContractVersion: "1" },
    ],
});

describe("평가 표면이 계약이 선언한 칸을 낸다", () => {
    it("실험 목록의 항목이 Experiment 의 칸을 낸다", async () => {
        const { experiments } = seeded();
        const { experiments: rows } = await experiments.list(USER);
        expectContractFields(rows[0], "Experiment");
    });

    it("실험 초안이 Experiment 와 ExperimentVariant 의 칸을 낸다", async () => {
        const { experiments } = surface();
        const created = await experiments.create(USER, CREATE_BODY);
        expectContractFields(created.experiment, "Experiment");
        expectContractFields(created.variants[0], "ExperimentVariant");
    });

    it("실험 상세가 Experiment 와 ExperimentVariant 의 칸을 낸다", async () => {
        const { experiments } = seeded();
        const detail = await experiments.get(USER, EXPERIMENT);
        expectContractFields(detail.experiment, "Experiment");
        expectContractFields(detail.variants[0], "ExperimentVariant");
    });

    it("예고가 ExperimentPreview 의 칸을 낸다", async () => {
        const { experiments } = seeded();
        expectContractFields(await experiments.preview(USER, EXPERIMENT), "ExperimentPreview");
    });

    it("실행 목록이 ExperimentExecution 과 EvaluationScore 의 칸을 낸다", async () => {
        const { experiments } = seeded();
        const { executions } = await experiments.executions(USER, EXPERIMENT);
        expectContractFields(executions[0]?.execution, "ExperimentExecution");
        expectContractFields(executions[0]?.scores[0], "EvaluationScore");
    });

    it("비교가 VariantComparison 의 칸을 낸다", async () => {
        const { experiments } = seeded();
        const comparison = await experiments.compare(USER, EXPERIMENT);
        expectContractFields(comparison.variants[0], "VariantComparison");
        expect(Object.keys(comparison).sort()).toEqual(["experimentId", "status", "variants"]);
    });

    it("시작이 Experiment 와 워크플로 식별자를 낸다", async () => {
        const { experiments } = seeded();
        const preview = await experiments.preview(USER, EXPERIMENT);
        const started = await experiments.start(USER, EXPERIMENT, startExperimentSchema.parse({
            confirmation: {
                executionCount: preview.executionCount,
                maxBudgetUsd: preview.maxBudgetUsd,
                fingerprint: preview.fingerprint,
            },
        }));
        expectContractFields(started.experiment, "Experiment");
        expect(Object.keys(started).sort()).toEqual(["experiment", "workflowId"]);
    });

    it("중단이 Experiment 와 워크플로 중단 결과를 낸다", async () => {
        const { experiments } = seeded();
        const cancelled = await experiments.cancel(USER, EXPERIMENT);
        expectContractFields(cancelled.experiment, "Experiment");
        expect(Object.keys(cancelled).sort()).toEqual(["experiment", "workflowCancellation"]);
    });

    it("검토 목록의 항목이 HumanReview 의 칸을 낸다", async () => {
        const { reviews } = seeded();
        await reviews.submit(USER, EXPERIMENT, submitReviewSchema.parse({
            executionAId: "execution-1", executionBId: "execution-2", preference: "a",
        }));
        const { reviews: rows } = await reviews.list(USER, EXPERIMENT);
        expectContractFields(rows[0], "HumanReview");
    });

    it("검토 제출이 HumanReview 의 칸을 낸다", async () => {
        const { reviews } = seeded();
        const review = await reviews.submit(USER, EXPERIMENT, submitReviewSchema.parse({
            executionAId: "execution-1", executionBId: "execution-2", preference: "tie",
        }));
        expectContractFields(review, "HumanReview");
    });

    it("뽑은 짝이 ReviewPair 의 칸을 낸다", async () => {
        const { reviews } = seeded();
        const pair = await reviews.next(USER, EXPERIMENT);
        expectContractFields(pair, "ReviewPair");
    });
});

describe("평가 표면이 계약이 정한 규칙을 지킨다", () => {
    it("짝의 한쪽이 어느 변형의 실행인지 싣지 않는다", async () => {
        const { reviews } = seeded();
        const pair = await reviews.next(USER, EXPERIMENT);
        for (const side of [pair?.executionA, pair?.executionB]) {
            expectContractFields(side, "ReviewPairSide");
            expect(side).not.toHaveProperty("variantId");
        }
    });

    it("baseline 이 하나가 아닌 초안을 받지 않는다", async () => {
        const { experiments } = surface();
        const twoBaselines = { ...CREATE_BODY, variants: CREATE_BODY.variants.map((row) => ({ ...row, baseline: true })) };
        await expect(experiments.create(USER, twoBaselines)).rejects.toThrow();
        const noBaseline = { ...CREATE_BODY, variants: CREATE_BODY.variants.map((row) => ({ ...row, baseline: false })) };
        await expect(experiments.create(USER, noBaseline)).rejects.toThrow();
    });

    it("이름이 서로 같은 변형을 세운 초안을 받지 않는다", async () => {
        const { experiments } = surface();
        const sameName = {
            ...CREATE_BODY,
            variants: [CREATE_BODY.variants[0]!, { ...CREATE_BODY.variants[1]!, name: "baseline" }],
        };
        await expect(experiments.create(USER, sameName)).rejects.toThrow();
    });

    it("확인의 세 값 가운데 하나라도 예고와 어긋나면 실험을 시작하지 않는다", async () => {
        const { experiments } = seeded();
        const preview = await experiments.preview(USER, EXPERIMENT);
        const confirmation = {
            executionCount: preview.executionCount,
            maxBudgetUsd: preview.maxBudgetUsd,
            fingerprint: preview.fingerprint,
        };
        const drifted = [
            { ...confirmation, executionCount: confirmation.executionCount + 1 },
            { ...confirmation, maxBudgetUsd: confirmation.maxBudgetUsd + 1 },
            { ...confirmation, fingerprint: `${confirmation.fingerprint}:다른 값` },
        ];
        for (const value of drifted) {
            await expect(experiments.start(USER, EXPERIMENT, startExperimentSchema.parse({ confirmation: value })))
                .rejects.toThrow();
        }
    });

    it("예고와 같은 확인을 받으면 실험을 실행에 올린다", async () => {
        const { experiments, dispatcher } = seeded();
        const preview = await experiments.preview(USER, EXPERIMENT);
        await experiments.start(USER, EXPERIMENT, startExperimentSchema.parse({
            confirmation: {
                executionCount: preview.executionCount,
                maxBudgetUsd: preview.maxBudgetUsd,
                fingerprint: preview.fingerprint,
            },
        }));
        expect(dispatcher.dispatched).toEqual([{ experimentId: EXPERIMENT, userId: USER }]);
    });

    it("성공한 실행이 받은 점수가 없으면 변형의 평균 점수를 비운다", async () => {
        const { repository, experiments } = seeded();
        repository.scores.splice(0, repository.scores.length);
        const comparison = await experiments.compare(USER, EXPERIMENT);
        expect(comparison.variants.map((row) => row.meanScore)).toEqual([null, null]);
    });

    it("점수가 있는 변형만 평균을 갖는다", async () => {
        const { experiments } = seeded();
        const comparison = await experiments.compare(USER, EXPERIMENT);
        expect(comparison.variants.find((row) => row.variantId === "variant-1")?.meanScore).toBe(1);
        expect(comparison.variants.find((row) => row.variantId === "variant-2")?.meanScore).toBeNull();
    });
});
