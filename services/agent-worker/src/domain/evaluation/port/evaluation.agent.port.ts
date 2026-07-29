import type { AgentId } from "~agent-worker/support/agent.const.js";
import type { EvaluationRunEnvelope, EvaluationRunResult } from "~agent-worker/domain/evaluation/model/evaluation.envelope.model.js";

/** Temporal 활동 계층이 채워 넘기는, 잡 봉투와 무관한 실행 문맥이다. */
export interface EvaluationDispatchContext {
    /** experiment_executions.job_id로 그대로 들어가는 실행 식별자이며 agent.generate()의 jobId로도 쓴다. */
    readonly runId: string;
    /** Temporal이 세는 활동 시도 번호다. */
    readonly attempt: number;
    readonly idempotencyKey?: string;
    readonly abortSignal?: AbortSignal;
}

/** 에이전트 하나의 실제 실행을 스냅샷 도구로 한 번 도는 표면이다. */
export interface EvaluationAgentRunner {
    run(envelope: EvaluationRunEnvelope, ctx: EvaluationDispatchContext): Promise<EvaluationRunResult>;
}

/** 평가 실행을 배선할 수 있는 에이전트만 키를 가지며, 슬라이스 사이 import를 막는 구조 규칙 때문에 실제 구현은 이 슬라이스 밖 최상위 조립 근원에서 만들어져 이 포트로 주입된다. */
export type EvaluationAgentRegistry = Readonly<Partial<Record<AgentId, EvaluationAgentRunner>>>;
