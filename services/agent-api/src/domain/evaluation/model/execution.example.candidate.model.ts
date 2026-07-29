import type {
    ChatExecutionStepView,
    ChatExecutionView,
    ChatMessageView,
    JobExecutionStepView,
    JobExecutionView,
} from "./execution.source.view.model.js";

export interface ExecutionExampleCandidate {
    readonly sourceExecutionId: string;
    readonly agentName: string;
    readonly input: Record<string, unknown>;
    readonly evidence: Record<string, unknown>;
    readonly referenceOutput: Record<string, unknown> | null;
    readonly suggestedDisclosureClass: "production-masked";
    readonly excludedTruncatedTools: readonly string[];
}

const AGENT_BY_JOB_KIND: Readonly<Record<string, string>> = {
    title_suggestion: "title",
    recipe_scan: "recipe",
    task_cleanup: "cleanup",
    "title-suggestion": "title",
    "recipe-scan": "recipe",
    "task-cleanup": "cleanup",
};

export function agentNameForJobKind(kind: string): string | null {
    return AGENT_BY_JOB_KIND[kind] ?? null;
}

export function buildJobCandidate(
    job: JobExecutionView,
    steps: readonly JobExecutionStepView[],
): ExecutionExampleCandidate {
    const agentName = agentNameForJobKind(job.kind);
    if (agentName === null) throw new Error(`Job kind ${job.kind} is not evaluable`);
    const toolSteps = steps.filter((step) => step.role === "tool" && step.toolName !== null);
    const excludedTruncatedTools = uniqueTruncatedTools(toolSteps);
    return {
        sourceExecutionId: job.id,
        agentName,
        input: agentName === "cleanup" ? cleanupInput(job.input) : job.input,
        evidence: collectEvidence(toolSteps, excludedTruncatedTools),
        referenceOutput: Object.keys(job.result).length === 0 ? null : job.result,
        suggestedDisclosureClass: "production-masked",
        excludedTruncatedTools,
    };
}

export function buildChatCandidate(
    execution: ChatExecutionView,
    userMessage: ChatMessageView,
    assistantMessage: ChatMessageView,
    steps: readonly ChatExecutionStepView[],
): ExecutionExampleCandidate {
    const toolSteps = steps.filter((step) => step.role === "tool" && step.toolName !== null);
    const excludedTruncatedTools = uniqueTruncatedTools(toolSteps);
    return {
        sourceExecutionId: execution.id,
        agentName: "chat",
        input: { message: userMessage.content },
        evidence: collectEvidence(toolSteps, excludedTruncatedTools),
        referenceOutput: { response: assistantMessage.content },
        suggestedDisclosureClass: "production-masked",
        excludedTruncatedTools,
    };
}

function uniqueTruncatedTools(steps: readonly JobExecutionStepView[]): string[] {
    return [...new Set(steps.filter((step) => step.truncated).flatMap((step) => step.toolName ?? []))];
}

function collectEvidence(
    steps: readonly JobExecutionStepView[],
    excluded: readonly string[],
): Record<string, unknown> {
    const evidence: Record<string, unknown> = {};
    for (const step of steps) {
        if (step.toolName === null || excluded.includes(step.toolName)) continue;
        evidence[step.toolName] = parseContent(step.content);
    }
    return evidence;
}

function parseContent(content: string): unknown {
    try {
        return JSON.parse(content) as unknown;
    } catch {
        return content;
    }
}

function cleanupInput(input: Record<string, unknown>): Record<string, unknown> {
    const filters = input["filters"];
    if (typeof filters !== "object" || filters === null) return {};
    const maxSuggestions = (filters as Record<string, unknown>)["maxSuggestions"];
    return maxSuggestions === undefined ? {} : { maxSuggestions };
}
