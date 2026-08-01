import { createHash } from "node:crypto";
import {
    buildClaudeRunObservation,
    estimateCostUsd,
    type AgentExecutionFailure,
    type AgentQueryUsage,
    type AgentRunObservation,
    type JobStepPayload,
} from "@tracer-agent/llm";

export interface SuccessfulRunObservationInput {
    readonly executionId: string;
    readonly attempt: number;
    readonly jobId: string;
    readonly agentName: string;
    readonly modelRequested: string;
    readonly modelActual: string;
    readonly promptVersion: string;
    readonly promptFingerprint: unknown;
    readonly toolContractVersion: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly usage: AgentQueryUsage | null;
    readonly steps: readonly JobStepPayload[];
    readonly landed: boolean;
    readonly repairAttempted: boolean;
    readonly validationPassed: boolean;
    readonly validationErrorCodes?: readonly string[];
    readonly resolvedPromptHash?: string;
    readonly resolvedPromptHashes?: readonly {
        readonly templateKey: string;
        readonly contentHash: string;
    }[];
}

/** 성공한 실행을 종결 관측으로 만들며 입력 원문은 되돌릴 수 없는 해시만 남긴다. */
export function buildSuccessfulRunObservation(
    input: SuccessfulRunObservationInput,
): AgentRunObservation {
    const common = buildClaudeRunObservation(
        {
            executionId: input.executionId,
            attemptId: String(input.attempt),
            jobId: input.jobId,
            agentName: input.agentName,
            modelRequested: input.modelRequested,
            promptVersion: input.promptVersion,
            promptContentHash: contentHash(input.promptFingerprint),
            toolContractVersion: input.toolContractVersion,
            modelCallId: `${input.executionId}:${input.attempt}:aggregate-model-call`,
            repairAttempted: input.repairAttempted,
            validation: {
                passed: input.validationPassed,
                errorCodes: input.validationPassed
                    ? []
                    : [...(input.validationErrorCodes ?? ["deterministic_validation_failed"])],
                citationPrecision: null,
                citationRecall: null,
            },
        },
        {
            rawOutput: "",
            structuredOutput: null,
            durationMs: input.durationMs,
            numTurns: null,
            costUsd: input.costUsd,
            usage: input.usage,
            steps: input.steps,
            errorSummary: null,
            errorSubtype: null,
            landed: input.landed,
            actualModel: input.modelActual,
            providerRequestId: null,
        },
    );
    if (input.resolvedPromptHash === undefined || input.resolvedPromptHashes === undefined) {
        return common;
    }
    return {
        ...common,
        resolvedPromptHash: input.resolvedPromptHash,
        resolvedPromptHashes: input.resolvedPromptHashes,
    };
}

function contentHash(value: unknown): string {
    return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

export interface FailedRunObservationInput {
    readonly executionId: string;
    readonly attempt: number;
    readonly jobId: string;
    readonly agentName: string;
    readonly modelRequested: string;
    readonly promptVersion: string;
    readonly promptFingerprint: unknown;
    readonly toolContractVersion: string;
    readonly failure: AgentExecutionFailure;
}

/** 공급자 오류 본문은 버리고 정규화한 서브타입과 사용량과 궤적만 실패 시도 관측으로 만든다. */
export function buildFailedRunObservation(input: FailedRunObservationInput): AgentRunObservation {
    const actualModel = input.failure.actualModel;
    return buildClaudeRunObservation(
        {
            executionId: input.executionId,
            attemptId: String(input.attempt),
            jobId: input.jobId,
            agentName: input.agentName,
            modelRequested: input.modelRequested,
            promptVersion: input.promptVersion,
            promptContentHash: contentHash(input.promptFingerprint),
            toolContractVersion: input.toolContractVersion,
            modelCallId: `${input.executionId}:${input.attempt}:aggregate-model-call`,
            repairAttempted: false,
            validation: {
                passed: false,
                errorCodes: [input.failure.code],
                citationPrecision: null,
                citationRecall: null,
            },
        },
        {
            rawOutput: "",
            structuredOutput: null,
            durationMs: input.failure.durationMs ?? 0,
            numTurns: null,
            costUsd: actualModel === null ? null : estimateCostUsd(actualModel, input.failure.usage),
            usage: input.failure.usage,
            steps: input.failure.steps,
            errorSummary: null,
            errorSubtype: input.failure.errorSubtype ?? "agent_execution_error",
            landed: false,
            actualModel,
            providerRequestId: input.failure.providerRequestId,
        },
    );
}
