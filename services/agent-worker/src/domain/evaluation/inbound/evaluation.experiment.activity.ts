import type { RunExperimentStepUsecase } from "~agent-worker/domain/evaluation/application/run.experiment.step.usecase.js";
import type { EvaluationExperimentFinalizeInput, EvaluationExperimentInput } from "~agent-worker/domain/evaluation/model/evaluation.experiment.model.js";

/** 오케스트레이션 엔진의 활동 표면을 실험 단계 유스케이스에 잇는다. */
export class EvaluationExperimentActivity {
    constructor(private readonly runStep: RunExperimentStepUsecase) {}

    runNext = (input: EvaluationExperimentInput): Promise<boolean> => this.runStep.execute(input);

    finalize = (input: EvaluationExperimentFinalizeInput): Promise<void> => this.runStep.finalize(input);
}
