import type { AgentBackend, AgentRunObservation, PromptIntegrityContract, ResolvedAgentPrompt } from "@tracer-agent/llm";
import type { AgentId } from "~agent-worker/support/agent.const.js";

/** 운영 잡과 수명을 공유하지 않도록 별개로 둔, 평가 실행을 에이전트에게 위임할 때의 실행 인자다. */
export interface EvaluationRunEnvelope {
    readonly experimentId: string;
    readonly variantId: string;
    readonly exampleId: string;
    readonly repetition: number;
    readonly agentName: AgentId;
    readonly backend: AgentBackend;
    /** evaluation_examples.input이며 에이전트별 필수·선택 필드는 예제 계약 픽스처가 소유한다. */
    readonly input: Record<string, unknown>;
    /** evaluation_examples.evidence이며 도구 이름을 그 도구가 돌려줄 스냅샷 값에 대응시킨다. */
    readonly evidence: Record<string, unknown>;
    readonly referenceOutput?: Record<string, unknown> | null;
    readonly evaluatorDefinitions?: readonly EvaluationEvaluatorDefinition[];
    /** 동결된 prompt version과 해시이며 실행기는 파일에서 렌더링한 프롬프트를 이 해시와 대조한다. */
    readonly prompt: ResolvedAgentPrompt;
    /** 없으면 legacy full prompt 검증이며, override 실행은 resolved-fragments mode를 반드시 명시한다. */
    readonly promptIntegrity?: PromptIntegrityContract;
    readonly model?: string;
    /** local이 아닌 프로파일에서 구독 인증을 못 쓰는 실행에만 필요하며, agent-worker가 내부 실행 계약으로 전달받는다. */
    readonly apiKey?: string;
}

export interface EvaluationEvaluatorDefinition {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly implementationHash: string;
    readonly enabled: boolean;
    readonly config: Readonly<Record<string, unknown>>;
}

/** 평가 실행 한 번의 결과이며 jobId는 experiment_executions.job_id에 그대로 들어가는 실행 식별자(Temporal workflow id)다. */
export interface EvaluationRunResult {
    readonly jobId: string;
    readonly output: Record<string, unknown>;
    readonly observation: AgentRunObservation;
    readonly scores?: readonly EvaluationScore[];
}

export interface EvaluationScore {
    readonly evaluatorId: string;
    readonly evaluatorVersion: string;
    readonly score: number | null;
    readonly label: "pass" | "fail" | "not_evaluable";
    readonly reason: string;
    readonly judgeCostUsd: number;
}
