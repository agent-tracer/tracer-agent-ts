import type { AgentRunObservation, GeneratedJobStep, ResolvedAgentPrompt } from "@tracer-agent/llm";
import type { AgentUsageSummary } from "~agent-worker/support/llm/job.attempt.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import type { TitleContext } from "./title.context.model.js";
import type { TitleSuggestionPayload } from "./title.suggestion.schema.js";

/** 워크플로가 넘기는 제목 제안 잡 입력이다. */
export interface TitleSuggestionInput {
    readonly jobId: string;
    readonly taskId: string;
}

/** 준비와 생성과 종결 사이를 오가는 순수 데이터 계약이다. */
export interface TitleSuggestionPrep {
    readonly jobId: string;
    readonly userId: string;
    readonly taskId: string;
    readonly language: OutputLanguage;
    readonly currentTitle: string;
    readonly context: TitleContext;
    readonly prompt: ResolvedAgentPrompt;
    readonly model?: string;
}

/** 잡 실행 전체의 도구 순환 궤적과 걸러낸 제안을 함께 담는다. */
export interface TitleSuggestionGenerateOutput extends AgentUsageSummary {
    readonly suggestions: readonly TitleSuggestionPayload[];
    readonly jobSteps: readonly GeneratedJobStep[];
    readonly observation: AgentRunObservation;
}

export interface TitleSuggestionFinalizeInput {
    readonly jobId: string;
    readonly userId: string;
    readonly output: TitleSuggestionGenerateOutput;
}

export interface FailTitleJobInput {
    readonly jobId: string;
    readonly message: string;
}
