import type {
    AgentQueryUsage,
    AgentRunObservation,
    JobStepPayload,
    ResolvedAgentPrompt,
} from "@tracer-agent/llm";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import type { ProvenanceSnapshot } from "~agent-worker/domain/recipe/model/recipe.provenance.model.js";
import type { RecipeCandidatePayload } from "~agent-worker/domain/recipe/model/recipe.scan.schema.js";

export interface GenerateRecipeCandidatesInput {
    readonly prompt: ResolvedAgentPrompt;
    readonly jobId: string;
    readonly userId: string;
    readonly taskId: string;
    readonly language: OutputLanguage;
    /** 오케스트레이터가 세는 시도 번호이며 같은 시도의 재개와 새 시도를 구분한다. */
    readonly attempt: number;
    readonly apiKey?: string;
    readonly model?: string;
    readonly userPrompt?: string;
    readonly idempotencyKey?: string;
    readonly abortSignal?: AbortSignal;
}

export interface GenerateRecipeCandidatesOutput {
    readonly recipes: readonly RecipeCandidatePayload[];
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
    /** 모델과 도구 실행의 궤적이며 모든 구현체가 채운다. */
    readonly steps: readonly JobStepPayload[];
    /** 실행 중 도구가 돌려준 ID 장부이며 외부에서 도구를 실행한 구현체는 자기 장부를 싣는다. */
    readonly provenance: ProvenanceSnapshot;
    readonly observation: AgentRunObservation;
}

/** 잡 실행이 구현하는 레시피 후보 생성 계약이다. */
export interface RecipeAgentPort {
    requiresLocalApiKey(): boolean;
    generate(input: GenerateRecipeCandidatesInput): Promise<GenerateRecipeCandidatesOutput>;
}
