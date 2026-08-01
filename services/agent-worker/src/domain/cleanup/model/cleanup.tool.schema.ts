import {
    contractEnumValues,
    contractIntDefault,
    contractIntMax,
    contractLimit,
    contractToolDefinitions,
    contractToolShape,
    type ContractToolFile,
    type LlmToolDefinition,
    type ToolFailureTexts,
} from "@tracer-agent/llm";
import { z } from "zod";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { readAgentTools } from "~agent-worker/support/contract.js";

export const TASK_CLEANUP_TOOL = {
    listCandidateTasks: "list_candidate_tasks",
    getTaskEvents: "get_task_events",
} as const;

export type TaskCleanupToolName = (typeof TASK_CLEANUP_TOOL)[keyof typeof TASK_CLEANUP_TOOL];

/** 두 구현체가 함께 읽는 도구 계약이며 값은 계약 저장소가 소유한다. */
export const CLEANUP_TOOL_CONTRACT: ContractToolFile = readAgentTools(AGENT.taskCleanup.id);

export const EVENT_ORDER = { asc: "asc", desc: "desc" } as const;
export type EventOrder = (typeof EVENT_ORDER)[keyof typeof EVENT_ORDER];

/** 이 도구가 허용하는 읽기 방향이며 첫 값이 계약이 정한 기본이다. */
export const EVENT_ORDERS = contractEnumValues(
    CLEANUP_TOOL_CONTRACT,
    TASK_CLEANUP_TOOL.getTaskEvents,
    "order",
);

export const DEFAULT_EVENT_ORDER = EVENT_ORDERS[0] as EventOrder;
export const DEFAULT_EVENT_LIMIT = contractIntDefault(
    CLEANUP_TOOL_CONTRACT,
    TASK_CLEANUP_TOOL.getTaskEvents,
    "limit",
);
export const MAX_EVENT_LIMIT = contractIntMax(
    CLEANUP_TOOL_CONTRACT,
    TASK_CLEANUP_TOOL.getTaskEvents,
    "limit",
);
export const DEFAULT_CANDIDATE_LIMIT = contractIntDefault(
    CLEANUP_TOOL_CONTRACT,
    TASK_CLEANUP_TOOL.listCandidateTasks,
    "limit",
);
export const MAX_CANDIDATE_LIMIT = contractIntMax(
    CLEANUP_TOOL_CONTRACT,
    TASK_CLEANUP_TOOL.listCandidateTasks,
    "limit",
);

/** 한 실행이 낼 수 있는 제안의 상한이다. */
export const CLEANUP_MAX_SUGGESTIONS = contractLimit(CLEANUP_TOOL_CONTRACT, "maxSuggestions");

/** 제안 하나가 인용할 수 있는 이벤트 식별자의 상한이다. */
export const CLEANUP_MAX_EVIDENCE_EVENT_IDS = contractLimit(
    CLEANUP_TOOL_CONTRACT,
    "maxEvidenceEventIds",
);

/** 조율자가 후보를 다시 열어보게 할 수 있는 라운드 수이며 무한 반복을 이 값으로 막는다. */
export const MAX_REDISPATCH_ROUNDS = contractLimit(CLEANUP_TOOL_CONTRACT, "maxRedispatchRounds");

/** 후보 하나에 배정할 수 있는 검토 몫의 상한이다. */
export const MAX_INSPECT_WEIGHT = contractLimit(CLEANUP_TOOL_CONTRACT, "maxInspectWeight");

const listCandidateTasksShape = contractToolShape(
    CLEANUP_TOOL_CONTRACT.tools[TASK_CLEANUP_TOOL.listCandidateTasks]!,
);
const getTaskEventsShape = contractToolShape(
    CLEANUP_TOOL_CONTRACT.tools[TASK_CLEANUP_TOOL.getTaskEvents]!,
);

/** task-cleanup이 모델에게 노출하는 도구 계약이다. */
export const TASK_CLEANUP_TOOLS: readonly LlmToolDefinition[] =
    contractToolDefinitions(CLEANUP_TOOL_CONTRACT);

export const TASK_CLEANUP_TOOL_NAMES: readonly string[] = TASK_CLEANUP_TOOLS.map((spec) => spec.name);

export interface ListCandidateTasksArgs {
    readonly limit?: number;
    readonly cursor?: string;
}

export interface GetTaskEventsArgs {
    readonly taskId: string;
    readonly limit?: number;
    readonly cursor?: string;
    readonly order?: EventOrder;
}

export function parseListCandidateTasksArgs(raw: unknown): ListCandidateTasksArgs {
    return z.object(listCandidateTasksShape).parse(raw);
}

export function parseGetTaskEventsArgs(raw: unknown): GetTaskEventsArgs {
    return z.object(getTaskEventsShape).parse(raw) as GetTaskEventsArgs;
}

/** 도구가 무너졌을 때와 검토 하나가 통째로 무너졌을 때 모델과 조율자가 읽는 문구이며 값은 계약이 소유한다. */
export const TASK_CLEANUP_FAILURES: ToolFailureTexts & { readonly workerFailed: string } =
    CLEANUP_TOOL_CONTRACT.failures as ToolFailureTexts & { readonly workerFailed: string };
