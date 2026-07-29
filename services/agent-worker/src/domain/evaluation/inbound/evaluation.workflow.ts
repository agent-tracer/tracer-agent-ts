import { proxyActivities } from "@temporalio/workflow";
import type { EvaluationRunEnvelope, EvaluationRunResult } from "~agent-worker/domain/evaluation/model/evaluation.envelope.model.js";

/** 긴 모델 호출이 짧은 활동의 슬롯을 굶기지 않도록 분리한 큐이며 값은 계약이 소유한다. */
const GENERATE_TASK_QUEUE = "sdk-generate";

interface EvaluationGenerateActivities {
    runEvaluationAgent(envelope: EvaluationRunEnvelope): Promise<EvaluationRunResult>;
}

const { runEvaluationAgent } = proxyActivities<EvaluationGenerateActivities>({
    taskQueue: GENERATE_TASK_QUEUE,
    startToCloseTimeout: "5 minutes",
    scheduleToCloseTimeout: "20 minutes",
    heartbeatTimeout: "30 seconds",
    // 평가 실행은 유료 재시도가 실험 예산을 넘길 수 있으므로 운영 잡보다 재시도 여지를 좁게 둔다.
    retry: { maximumAttempts: 2, initialInterval: "10 seconds" },
});

/** 평가 실행 한 번을 돌며, 결과의 jobId는 experiment_executions.job_id로 그대로 들어간다. */
export async function evaluationRunWorkflow(envelope: EvaluationRunEnvelope): Promise<EvaluationRunResult> {
    return runEvaluationAgent(envelope);
}
