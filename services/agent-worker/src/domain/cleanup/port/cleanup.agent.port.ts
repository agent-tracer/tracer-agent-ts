import type {
    AgentQueryUsage,
    AgentRunObservation,
    JobStepPayload,
    ResolvedAgentPrompt,
} from "@tracer-agent/llm";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import type { CleanupCandidate } from "~agent-worker/domain/cleanup/model/cleanup.candidate.model.js";
import type { CleanupSuggestionPayload } from "~agent-worker/domain/cleanup/model/cleanup.suggestion.schema.js";

export interface GenerateCleanupSuggestionsInput {
    readonly prompt: ResolvedAgentPrompt;
    readonly jobId: string;
    readonly userId: string;
    readonly language: OutputLanguage;
    /** stale 판단의 기준이 되는 이번 스캔의 기준 시각이다. */
    readonly scannedAt: string;
    readonly candidates: readonly CleanupCandidate[];
    /** 서버 조회가 상한에 걸려 이 배치가 후보 전체를 담지 못했는지 여부다. */
    readonly truncated: boolean;
    readonly maxSuggestions: number;
    /** 오케스트레이터가 세는 시도 번호이며, 같은 시도의 재개와 새 시도를 구분한다. */
    readonly attempt: number;
    readonly apiKey?: string;
    readonly model?: string;
    readonly idempotencyKey?: string;
    readonly abortSignal?: AbortSignal;
}

export interface GenerateCleanupSuggestionsOutput {
    readonly suggestions: readonly CleanupSuggestionPayload[];
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
    /** 모델과 도구 실행의 궤적이며 모든 구현체가 채운다. */
    readonly steps: readonly JobStepPayload[];
    readonly observation: AgentRunObservation;
}

/** 잡 실행이 구현하는 태스크 정리 제안 생성 계약이다. */
export interface CleanupAgentPort {
    requiresLocalApiKey(): boolean;
    generate(input: GenerateCleanupSuggestionsInput): Promise<GenerateCleanupSuggestionsOutput>;
}
