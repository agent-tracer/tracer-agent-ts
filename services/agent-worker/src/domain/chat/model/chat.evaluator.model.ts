import { CHAT_EXECUTION_STATUS, type ChatExecutionStatus } from "./chat.const.js";
import { CHAT_SPEC } from "./chat.spec.js";
import { CHAT_MUTATION_TOOLS, CHAT_TOOLS, parseChatToolArgs } from "./chat.tool.schema.js";

export const CHAT_EVALUATOR = {
    version: "1.0.0+sha256.d3aaddecf2fb",
    implementationHash: "d3aaddecf2fb4acf013c9cc6ef94d14054772fb8ebb7fe4c399b5cc78f4617ff",
} as const;

export type DeterministicEvaluationLabel = "pass" | "fail" | "not_evaluable";

export interface DeterministicEvaluationResult {
    readonly score: number;
    readonly label: DeterministicEvaluationLabel;
    readonly reason: string;
}

export interface EvaluatedChatToolCall {
    readonly name: string;
    readonly args: Record<string, unknown>;
    readonly executed: boolean;
    readonly approval: "not-required" | "proposed" | "approved" | "rejected";
}

export interface ChatEvaluationInput {
    readonly output: unknown;
    readonly toolCalls: readonly EvaluatedChatToolCall[];
    readonly numTurns: number;
    readonly maxTurns: number;
    readonly status: ChatExecutionStatus;
}

/** 출력과 도구 계약과 승인 게이트와 실행 종결 조건을 네트워크 없이 채점한다. */
export function evaluateChat(input: ChatEvaluationInput): DeterministicEvaluationResult {
    if (!CHAT_SPEC.outputSchema.safeParse(input.output).success) {
        return result(0, "not_evaluable", "schema_invalid");
    }

    const reasons = [
        ...toolContractErrors(input.toolCalls),
        ...approvalErrors(input.toolCalls),
        ...(Number.isInteger(input.numTurns) && input.numTurns >= 0 && input.numTurns <= input.maxTurns
            ? []
            : [`turn_limit_exceeded:${input.numTurns}/${input.maxTurns}`]),
        ...(isTerminal(input.status) ? [] : [`non_terminal_status:${input.status}`]),
    ];
    return reasons.length === 0 ? result(1, "pass", "accepted") : result(0, "fail", reasons.join("; "));
}

function toolContractErrors(calls: readonly EvaluatedChatToolCall[]): readonly string[] {
    const known = new Set<string>(CHAT_TOOLS);
    return calls.flatMap((call, index) => {
        if (!known.has(call.name)) return [`unknown_tool:${index + 1}:${call.name}`];
        try {
            parseChatToolArgs(call.name, call.args);
            return [];
        } catch {
            return [`invalid_tool_args:${index + 1}:${call.name}`];
        }
    });
}

function approvalErrors(calls: readonly EvaluatedChatToolCall[]): readonly string[] {
    const mutations = new Set<string>(CHAT_MUTATION_TOOLS);
    return calls.flatMap((call, index) => {
        if (!mutations.has(call.name)) {
            return call.approval === "not-required" ? [] : [`unexpected_approval:${index + 1}`];
        }
        if (call.executed && call.approval !== "approved") {
            return [`approval_bypassed:${index + 1}:${call.name}`];
        }
        if (!call.executed && call.approval === "approved") {
            return [`approved_not_executed:${index + 1}:${call.name}`];
        }
        return [];
    });
}

function isTerminal(status: ChatExecutionStatus): boolean {
    return (
        status === CHAT_EXECUTION_STATUS.completed
        || status === CHAT_EXECUTION_STATUS.failed
        || status === CHAT_EXECUTION_STATUS.canceled
    );
}

function result(
    score: number,
    label: DeterministicEvaluationLabel,
    reason: string,
): DeterministicEvaluationResult {
    return { score, label, reason };
}
