import { renderFailureText } from "@tracer-agent/llm";
import { MAX_INSPECT_REASON_CHARS, type InspectReport } from "./cleanup.dispatch.schema.js";
import {
    CLEANUP_TOOL_CONTRACT,
    TASK_CLEANUP_FAILURES,
    TASK_CLEANUP_TOOL,
    type TaskCleanupToolName,
} from "./cleanup.tool.schema.js";

// 첫 실행이 예산을 거의 다 써도 수리가 고쳐 쓴 출력을 낼 최소 여지는 남긴다.
export const REPAIR_RESERVED_TURNS = 2;
export const REPAIR_RESERVED_BUDGET_SHARE = 0.2;

// 후보 목록을 조회하고 무엇을 조사할지 정하는 데 예약해 두는 턴이다.
export const TRIAGE_TURNS = 3;
export const TRIAGE_BUDGET_SHARE = 0.2;

// 결정에 먼저 떼어 두는, 후보 조사에 넘기지 않는 최소 턴이다.
export const MIN_DECISION_TURNS = 3;

export const CLEANUP_REVIEWER_ROLE = "cleanup-candidate-reviewer";

// 선별자는 요청이 실어 준 후보 배치만 보고 검토 전문가만 이벤트를 연다.
export const CLEANUP_TRIAGE_TOOLS = [] as const;
export const CLEANUP_REVIEWER_TOOLS = [TASK_CLEANUP_TOOL.getTaskEvents] as const;
// 조율자는 근거를 직접 모으지 않고 검토 전문가의 보고만으로 제안을 쓰므로 도구를 갖지 않는다.
export const CLEANUP_COORDINATOR_TOOLS: readonly TaskCleanupToolName[] = [];

// 검토 전문가 하나가 받을 수 있는 턴 백스톱이며 값은 계약이 갖는다.
export const CLEANUP_REVIEWER_MAX_TURNS = CLEANUP_TOOL_CONTRACT.orchestration.workerMaxTurns;

/** 후보 하나의 조사가 실패한 사유를 판정 상한 안으로 줄이고, 실패한 후보는 안전하게 보관 불가로 올린다. */
export function buildInspectFailureReport(taskId: string, error: unknown): InspectReport {
    const summary = messageOf(error).trim() || "unknown error";
    return {
        taskId,
        archivable: false,
        reason: renderFailureText(TASK_CLEANUP_FAILURES.workerFailed, { reason: summary }).slice(
            0,
            MAX_INSPECT_REASON_CHARS,
        ),
        citedEventIds: [],
    };
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
