import type {
    AgentQueryUsage,
    AgentRunObservation,
    JobStepPayload,
    ResolvedAgentPrompt,
} from "@tracer-agent/llm";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import type { TitleContext } from "~agent-worker/domain/title/model/title.context.model.js";
import type { TitleSuggestionPayload } from "~agent-worker/domain/title/model/title.suggestion.schema.js";

export interface GenerateTitleSuggestionsInput {
    readonly jobId: string;
    readonly userId: string;
    readonly taskId: string;
    readonly language: OutputLanguage;
    readonly context: TitleContext;
    readonly prompt: ResolvedAgentPrompt;
    /** 오케스트레이터가 세는 시도 번호이며 같은 시도의 재개와 새 시도를 가른다. */
    readonly attempt: number;
    readonly apiKey?: string;
    readonly model?: string;
    readonly idempotencyKey?: string;
    readonly abortSignal?: AbortSignal;
}

export interface GenerateTitleSuggestionsOutput {
    readonly suggestions: readonly TitleSuggestionPayload[];
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
    /** 모델과 도구 실행의 궤적이며 모든 구현체가 채운다. */
    readonly steps: readonly JobStepPayload[];
    readonly observation: AgentRunObservation;
}

/** 잡 실행이 구현하는 제목 제안 생성 계약이다. */
export interface TitleAgentPort {
    requiresLocalApiKey(): boolean;
    generate(input: GenerateTitleSuggestionsInput): Promise<GenerateTitleSuggestionsOutput>;
}
