import { type ToolHandlers, withToolTelemetry } from "@tracer-agent/llm";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { clampInt } from "~agent-worker/support/clamp.js";
import {
    toCleanupCandidatePage,
    type CleanupCandidate,
} from "~agent-worker/domain/cleanup/model/cleanup.candidate.model.js";
import { toCleanupEventPage, type CleanupSlimEvent } from "~agent-worker/domain/cleanup/model/cleanup.event.model.js";
import { CleanupProvenanceLedger } from "~agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import {
    DEFAULT_CANDIDATE_LIMIT,
    DEFAULT_EVENT_LIMIT,
    DEFAULT_EVENT_ORDER,
    EVENT_ORDER,
    MAX_CANDIDATE_LIMIT,
    MAX_EVENT_LIMIT,
    parseGetTaskEventsArgs,
    parseListCandidateTasksArgs,
    TASK_CLEANUP_TOOL,
} from "~agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import type { CleanupEvent, CleanupEventReaderPort, CleanupTaskReaderPort } from "~agent-worker/domain/cleanup/port/cleanup.reader.port.js";

const AGENT_NAME = AGENT.taskCleanup.id;

/** cleanup 도구가 쓰는 저장소 읽기 표면을 묶는다. */
export interface CleanupToolDeps {
    readonly tasks: CleanupTaskReaderPort;
    readonly events: CleanupEventReaderPort;
}

/** 이번 실행의 후보 배치이며 도구가 모델에게 그대로 내준다. */
export interface CleanupToolBatch {
    readonly candidates: readonly CleanupCandidate[];
    /** 서버 조회 상한에 걸려 이번 배치가 후보 전체를 담지 못했는지 여부다. */
    readonly batchTruncated: boolean;
}

/** 사용자 범위와 후보 배치와 실행 단위 근거 장부를 고정한 cleanup 슬라이스 소유의 도구 핸들러를 만든다. */
export function buildCleanupToolHandlers(
    userId: string,
    deps: CleanupToolDeps,
    batch: CleanupToolBatch,
    ledger: CleanupProvenanceLedger = new CleanupProvenanceLedger(),
): ToolHandlers {
    const candidateIds = new Set(batch.candidates.map((candidate) => candidate.id));
    return {
        [TASK_CLEANUP_TOOL.listCandidateTasks]: async (raw) => {
            const { limit, cursor } = parseListCandidateTasksArgs(raw);
            return withToolTelemetry(
                { toolName: TASK_CLEANUP_TOOL.listCandidateTasks, agentName: AGENT_NAME, parameters: { limit, cursor } },
                () => {
                    const size = clampInt(limit, DEFAULT_CANDIDATE_LIMIT, 1, MAX_CANDIDATE_LIMIT);
                    const page = toCleanupCandidatePage(batch.candidates, size, batch.batchTruncated, cursor);
                    ledger.recordCandidates(page.candidates);
                    return Promise.resolve(JSON.stringify(page));
                },
            );
        },

        [TASK_CLEANUP_TOOL.getTaskEvents]: async (raw) => {
            const { taskId, limit, cursor, order } = parseGetTaskEventsArgs(raw);
            if (!candidateIds.has(taskId)) return `Task ${taskId} not found.`;
            return withToolTelemetry(
                {
                    toolName: TASK_CLEANUP_TOOL.getTaskEvents,
                    agentName: AGENT_NAME,
                    parameters: { taskId, limit, cursor, order },
                },
                async () => {
                    const task = await deps.tasks.findById(userId, taskId);
                    if (task === null) return `Task ${taskId} not found.`;
                    const size = clampInt(limit, DEFAULT_EVENT_LIMIT, 1, MAX_EVENT_LIMIT);
                    const reading = order ?? DEFAULT_EVENT_ORDER;
                    const [rows, total] = await Promise.all([
                        reading === EVENT_ORDER.desc
                            ? deps.events.findTimelineWindow(userId, taskId, cursor, size + 1)
                            : deps.events.findTimeline(
                                userId,
                                taskId,
                                cursor !== undefined ? { seq: cursor } : undefined,
                                size + 1,
                            ),
                        deps.events.countByTask(userId, taskId),
                    ]);
                    const page = toCleanupEventPage(rows.map(toSlimEvent), size, total);
                    ledger.recordInspection(taskId, page.events);
                    return JSON.stringify(page);
                },
            );
        },
    };
}

function toSlimEvent(event: CleanupEvent): CleanupSlimEvent {
    return {
        id: event.id,
        seq: event.seq,
        kind: event.kind,
        title: event.title,
        ...(event.body !== null ? { body: event.body } : {}),
        ...(event.toolName !== null ? { toolName: event.toolName } : {}),
        filePaths: event.filePaths,
        occurredAt: event.occurredAt.toISOString(),
    };
}
