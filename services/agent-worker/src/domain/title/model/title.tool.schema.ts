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

export const TITLE_SUGGESTION_TOOL = {
    getTaskEvents: "get_task_events",
} as const;

export type TitleSuggestionToolName =
    (typeof TITLE_SUGGESTION_TOOL)[keyof typeof TITLE_SUGGESTION_TOOL];

/** 두 구현체가 함께 읽는 도구 계약이며 값은 계약 저장소가 소유한다. */
export const TITLE_TOOL_CONTRACT: ContractToolFile = readAgentTools(AGENT.titleSuggestion.id);

export const EVENT_ORDER = { asc: "asc", desc: "desc" } as const;

export type EventOrder = (typeof EVENT_ORDER)[keyof typeof EVENT_ORDER];

/** 이 도구가 허용하는 읽기 방향이며 첫 값이 계약이 정한 기본이다. */
export const EVENT_ORDERS = contractEnumValues(
    TITLE_TOOL_CONTRACT,
    TITLE_SUGGESTION_TOOL.getTaskEvents,
    "order",
);

export const MIN_EVENT_LIMIT = 1;
export const DEFAULT_EVENT_LIMIT = contractIntDefault(
    TITLE_TOOL_CONTRACT,
    TITLE_SUGGESTION_TOOL.getTaskEvents,
    "limit",
);
export const MAX_EVENT_LIMIT = contractIntMax(
    TITLE_TOOL_CONTRACT,
    TITLE_SUGGESTION_TOOL.getTaskEvents,
    "limit",
);
export const DEFAULT_EVENT_ORDER = EVENT_ORDERS[0] as EventOrder;

/** 프롬프트에 싣는 최근 대화 턴의 상한이며 값은 계약의 상한 절이 소유한다. */
export const RECENT_TURN_LIMIT = contractLimit(TITLE_TOOL_CONTRACT, "recentTurnLimit");

const getTaskEventsShape = contractToolShape(
    TITLE_TOOL_CONTRACT.tools[TITLE_SUGGESTION_TOOL.getTaskEvents]!,
);

/** 이 에이전트가 모델에게 여는 도구 계약이며 이름과 설명과 인자를 계약이 소유한다. */
export const TITLE_SUGGESTION_TOOLS: readonly LlmToolDefinition[] =
    contractToolDefinitions(TITLE_TOOL_CONTRACT);

export const TITLE_SUGGESTION_TOOL_NAMES: readonly string[] = TITLE_SUGGESTION_TOOLS.map(
    (spec) => spec.name,
);

export interface GetTaskEventsArgs {
    readonly taskId: string;
    readonly limit?: number;
    readonly cursor?: string;
    readonly order?: EventOrder;
}

export function parseGetTaskEventsArgs(raw: unknown): GetTaskEventsArgs {
    return z.object(getTaskEventsShape).parse(raw) as GetTaskEventsArgs;
}

/** 도구가 실패했을 때 모델이 읽는 문구이며 값은 계약이 소유한다. */
export const TITLE_SUGGESTION_FAILURES: ToolFailureTexts = TITLE_TOOL_CONTRACT.failures;
