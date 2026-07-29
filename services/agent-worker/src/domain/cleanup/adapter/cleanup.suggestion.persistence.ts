import { In, type EntityManager } from "typeorm";
import { CLEANUP_SUGGESTION_KIND_ARCHIVE, CLEANUP_SUGGESTION_STATUS_PENDING } from "~agent-worker/domain/cleanup/model/cleanup.const.js";
import type { GeneratedCleanupSuggestion } from "~agent-worker/domain/cleanup/model/cleanup.suggestion.model.js";
import { TaskCleanupSuggestionEntity } from "./cleanup.entity.js";

/** 보관 제안을 pending 상태로 저장한다. */
export async function persistCleanupSuggestions(
    manager: EntityManager,
    userId: string,
    jobId: string,
    suggestions: readonly GeneratedCleanupSuggestion[],
    now: Date,
): Promise<number> {
    if (suggestions.length === 0) return 0;
    const taskIds = suggestions.map((suggestion) => suggestion.taskId);
    const pending = await manager.getRepository(TaskCleanupSuggestionEntity).find({
        where: {
            userId,
            taskId: In(taskIds),
            kind: CLEANUP_SUGGESTION_KIND_ARCHIVE,
            status: CLEANUP_SUGGESTION_STATUS_PENDING,
        },
    });
    const pendingTaskIds = new Set(pending.map((suggestion) => suggestion.taskId));

    let suggestionsCreated = 0;
    for (const suggestion of suggestions) {
        // 대기 중인 제안이 이미 있는 태스크는 유니크 제약에 걸려 트랜잭션 전체를 abort시킨다.
        if (pendingTaskIds.has(suggestion.taskId)) continue;
        const entity = TaskCleanupSuggestionEntity.pending({ id: suggestion.id, userId, jobId, suggestion }, now);
        await manager.getRepository(TaskCleanupSuggestionEntity).insert(entity);
        pendingTaskIds.add(suggestion.taskId);
        suggestionsCreated += 1;
    }
    return suggestionsCreated;
}
