import {
    readEvidenceArray,
    readEvidenceObject,
    toSnapshotEvent,
    toSnapshotRule,
    toSnapshotTask,
    type EvidenceEvent,
    type EvidenceRule,
    type EvidenceTask,
} from "~agent-worker/domain/evaluation/model/evaluation.snapshot.model.js";
import {
    SnapshotRecipeSearch,
    SnapshotRuleReader,
    SnapshotTaskAndEventReader,
    type SnapshotSearchHit,
} from "~agent-worker/domain/evaluation/adapter/snapshot.readers.js";

const EVIDENCE_KEY = {
    task: "task",
    getTaskEvents: "get_task_events",
    listRules: "list_rules",
    searchEvents: "search_events",
    findSimilarTasks: "find_similar_tasks",
    searchRecipes: "search_recipes",
} as const;

function buildTaskAndEventReader(evidence: Record<string, unknown>, taskId: string): SnapshotTaskAndEventReader {
    const task = toSnapshotTask(taskId, readEvidenceObject<EvidenceTask>(evidence, EVIDENCE_KEY.task));
    const events = readEvidenceArray<EvidenceEvent>(evidence, EVIDENCE_KEY.getTaskEvents).map(toSnapshotEvent);
    return new SnapshotTaskAndEventReader(task, events);
}

/** title 에이전트가 요구하는 이벤트 조회 표면을 example의 evidence로 조립하며, 실제 포트 대조는 조립 근원이 한다. */
export function buildSnapshotTitleEvents(evidence: Record<string, unknown>, taskId: string): SnapshotTaskAndEventReader {
    return buildTaskAndEventReader(evidence, taskId);
}

/** cleanup 에이전트가 요구하는 이벤트 조회 표면을 example의 evidence로 조립하며, 실제 포트 대조는 조립 근원이 한다. */
export function buildSnapshotCleanupEvents(evidence: Record<string, unknown>, taskId: string): SnapshotTaskAndEventReader {
    return buildTaskAndEventReader(evidence, taskId);
}

/** recipe 에이전트가 요구하는 도구 의존을 example의 evidence로 조립하며, 검색 도구 셋도 evidence에서 채운다. */
export function buildSnapshotRecipeDeps(evidence: Record<string, unknown>, taskId: string): {
    readonly tasks: SnapshotTaskAndEventReader;
    readonly events: SnapshotTaskAndEventReader;
    readonly rules: SnapshotRuleReader;
    readonly search: SnapshotRecipeSearch;
} {
    const reader = buildTaskAndEventReader(evidence, taskId);
    const rules = readEvidenceArray<EvidenceRule>(evidence, EVIDENCE_KEY.listRules).map(toSnapshotRule);
    const search = new SnapshotRecipeSearch({
        events: readEvidenceArray<SnapshotSearchHit>(evidence, EVIDENCE_KEY.searchEvents),
        tasks: readEvidenceArray<SnapshotSearchHit>(evidence, EVIDENCE_KEY.findSimilarTasks),
        recipes: readEvidenceArray<SnapshotSearchHit>(evidence, EVIDENCE_KEY.searchRecipes),
    });
    return { tasks: reader, events: reader, rules: new SnapshotRuleReader(rules), search };
}
