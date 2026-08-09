import { Inject, Injectable } from "@nestjs/common";
import {
    CLEANUP_SUGGESTION_STATUS,
    CLEANUP_SUGGESTION_STATUSES,
    type CleanupSuggestionStatus,
} from "~agent-api/domain/cleanup/model/cleanup.const.js";
import type { CleanupSuggestion } from "~agent-api/domain/cleanup/model/cleanup.suggestion.model.js";
import {
    CLEANUP_SUGGESTION_REPOSITORY,
    type CleanupSuggestionRepositoryPort,
} from "~agent-api/domain/cleanup/port/cleanup.repository.port.js";
import {
    mapCleanupSuggestion,
    type CleanupSuggestionDto,
} from "~agent-api/domain/cleanup/application/cleanup.support.js";

export interface ListCleanupSuggestionsResult {
    readonly suggestions: readonly CleanupSuggestionDto[];
}

/** 정리 제안을 상태로 걸러 내며 대기 행은 태스크와 종류의 쌍으로 한 벌만 남긴다. */
@Injectable()
export class ListCleanupSuggestionsUseCase {
    constructor(
        @Inject(CLEANUP_SUGGESTION_REPOSITORY) private readonly suggestions: CleanupSuggestionRepositoryPort,
    ) {}

    async execute(userId: string, status?: CleanupSuggestionStatus): Promise<ListCleanupSuggestionsResult> {
        const rows = dedupePending(await this.collect(userId, status));
        return { suggestions: rows.map(mapCleanupSuggestion) };
    }

    /** 상태를 싣지 않으면 선언 순서로 이어 붙이고 전체를 다시 정렬하지 않는다. */
    private async collect(
        userId: string,
        status: CleanupSuggestionStatus | undefined,
    ): Promise<CleanupSuggestion[]> {
        if (status !== undefined) return this.suggestions.findByUserStatus(userId, status);
        const groups: CleanupSuggestion[][] = [];
        for (const declared of CLEANUP_SUGGESTION_STATUSES) {
            groups.push(await this.suggestions.findByUserStatus(userId, declared));
        }
        return groups.flat();
    }
}

/** 다른 상태의 행은 중복 제거 대상이 아니다. */
function dedupePending(rows: readonly CleanupSuggestion[]): CleanupSuggestion[] {
    const seen = new Set<string>();
    return rows.filter((row) => {
        if (row.status !== CLEANUP_SUGGESTION_STATUS.pending) return true;
        const key = `${row.taskId} ${row.kind}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
