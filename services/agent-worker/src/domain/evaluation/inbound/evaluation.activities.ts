import type { RunEvaluationUsecase } from "~agent-worker/domain/evaluation/application/run.evaluation.usecase.js";
import type { RunExperimentStepUsecase } from "~agent-worker/domain/evaluation/application/run.experiment.step.usecase.js";
import { EvaluationActivity } from "~agent-worker/domain/evaluation/inbound/evaluation.activity.js";
import { EvaluationExperimentActivity } from "~agent-worker/domain/evaluation/inbound/evaluation.experiment.activity.js";

/** Temporal 워커가 등록할 평가 활동 표를 두 유스케이스로 조립하며, 유스케이스 자체의 구성은 조립 근원이 한다. */
export function buildEvaluationActivities(input: {
    readonly runEvaluation: RunEvaluationUsecase;
    readonly runStep: RunExperimentStepUsecase;
}) {
    const evaluation = new EvaluationActivity(input.runEvaluation);
    const experiment = new EvaluationExperimentActivity(input.runStep);
    return {
        runEvaluationAgent: evaluation.runEvaluationAgent,
        runNext: experiment.runNext,
        finalize: experiment.finalize,
    };
}
