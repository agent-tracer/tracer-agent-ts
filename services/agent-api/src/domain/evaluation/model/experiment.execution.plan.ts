import type { ExperimentExecution } from "~agent-api/domain/evaluation/model/experiment.model.js";

/** 실행 하나가 자리를 잡는 좌표이며 이 셋이 실험 안에서 유일하다. */
export interface ExecutionCoordinate {
    readonly variantId: string;
    readonly exampleId: string;
    readonly repetition: number;
}

/** 실험이 돌 자리 전부를 variant 와 example 과 반복의 곱으로 편성한다. */
export function planExecutionCoordinates(
    variantIds: readonly string[],
    exampleIds: readonly string[],
    repetitions: number,
): readonly ExecutionCoordinate[] {
    const planned: ExecutionCoordinate[] = [];
    for (const variantId of variantIds) {
        for (const exampleId of exampleIds) {
            for (let repetition = 1; repetition <= repetitions; repetition += 1) {
                planned.push({ variantId, exampleId, repetition });
            }
        }
    }
    return planned;
}

/** 편성한 좌표마다 아직 아무도 가져가지 않은 실행 행을 만든다. */
export function buildPendingExecutions(
    experimentId: string,
    coordinates: readonly ExecutionCoordinate[],
    identify: (coordinate: ExecutionCoordinate) => string,
): readonly ExperimentExecution[] {
    return coordinates.map((coordinate) => ({
        id: identify(coordinate),
        experimentId,
        variantId: coordinate.variantId,
        exampleId: coordinate.exampleId,
        repetition: coordinate.repetition,
        status: "pending",
        output: null,
        error: null,
        costUsd: 0,
        startedAt: null,
        completedAt: null,
        attemptCount: 0,
        leaseOwner: null,
        leaseExpiresAt: null,
        jobId: null,
        traceId: null,
        resolvedPromptHash: null,
        durationMs: null,
        failureReason: null,
    }));
}
