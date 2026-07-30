import { proxyActivities, workflowInfo } from "@temporalio/workflow";
import type { EvaluationExperimentFinalizeInput, EvaluationExperimentInput } from "~agent-worker/domain/evaluation/model/evaluation.experiment.model.js";
import { generateTaskQueueOf } from "~agent-worker/support/task.queue.js";

interface EvaluationExperimentActivities {
    runNext(input: EvaluationExperimentInput): Promise<boolean>;
    finalize(input: EvaluationExperimentFinalizeInput): Promise<void>;
}

/** 긴 모델 호출이 짧은 활동의 슬롯을 굶기지 않도록 분리한 생성 큐로 보낸다. */
function generateActivities() {
    return proxyActivities<EvaluationExperimentActivities>({
        taskQueue: generateTaskQueueOf(workflowInfo().taskQueue),
        startToCloseTimeout: "20 minutes",
        heartbeatTimeout: "30 seconds",
        retry: { maximumAttempts: 2, initialInterval: "10 seconds" },
    });
}

/** 실험이 lease할 실행이 남는 동안 다음 단계를 반복하고, 끝나면 tracer-api의 실행 상태를 최종화한다. */
export async function evaluationExperimentWorkflow(input: EvaluationExperimentInput): Promise<void> {
    const { runNext, finalize } = generateActivities();
    let failed = false;
    try {
        let more = true;
        while (more) more = await runNext(input);
    } catch (error) {
        // 실패는 tracer-api의 실행 상태를 최종화할 수 있도록 보존한다.
        void error;
        failed = true;
    }
    await finalize({ ...input, cancelled: false, failed, budgetExhausted: false });
}
