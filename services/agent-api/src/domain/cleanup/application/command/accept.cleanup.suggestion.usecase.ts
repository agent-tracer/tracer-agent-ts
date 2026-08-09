import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { CleanupSuggestion } from "~agent-api/domain/cleanup/model/cleanup.suggestion.model.js";
import { CLEANUP_CLOCK, type ClockPort } from "~agent-api/domain/cleanup/port/clock.port.js";
import {
    CLEANUP_SUGGESTION_REPOSITORY,
    type CleanupSuggestionRepositoryPort,
} from "~agent-api/domain/cleanup/port/cleanup.repository.port.js";
import {
    CLEANUP_TASK_ARCHIVER,
    type CleanupTaskArchiverPort,
} from "~agent-api/domain/cleanup/port/cleanup.task.archiver.port.js";
import {
    mapCleanupSuggestion,
    type CleanupSuggestionDto,
} from "~agent-api/domain/cleanup/application/cleanup.support.js";

/** 제안을 수용으로 적은 뒤 추적에 조건부 보관을 요청하고 거절을 받으면 그 수용을 되돌린다. */
@Injectable()
export class AcceptCleanupSuggestionUseCase {
    constructor(
        @Inject(CLEANUP_SUGGESTION_REPOSITORY) private readonly suggestions: CleanupSuggestionRepositoryPort,
        @Inject(CLEANUP_TASK_ARCHIVER) private readonly archiver: CleanupTaskArchiverPort,
        @Inject(CLEANUP_CLOCK) private readonly clock: ClockPort,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly suggestion: CleanupSuggestionDto }> {
        const suggestion = await this.suggestions.findById(id);
        // 남의 제안은 존재 자체를 알리지 않는다.
        if (suggestion === null || !suggestion.isOwnedBy(userId)) {
            throw new NotFoundException("Cleanup suggestion not found");
        }
        // 끊긴 뒤의 재시도가 보관만 다시 밟도록 이미 수용된 제안은 원장을 바꾸지 않는다.
        if (suggestion.isAccepted()) {
            await this.archiveTask(userId, suggestion);
            return { suggestion: mapCleanupSuggestion(suggestion) };
        }

        suggestion.accept(this.clock.now());
        await this.suggestions.upsert(suggestion);
        await this.archiveOrRevert(userId, suggestion);
        return { suggestion: mapCleanupSuggestion(suggestion) };
    }

    private async archiveOrRevert(userId: string, suggestion: CleanupSuggestion): Promise<void> {
        try {
            await this.archiveTask(userId, suggestion);
        } catch (error) {
            suggestion.revertAcceptance();
            await this.suggestions.upsert(suggestion);
            throw error;
        }
    }

    private async archiveTask(userId: string, suggestion: CleanupSuggestion): Promise<void> {
        await this.archiver.archive(userId, suggestion.taskId, suggestion.observedLastEventAt);
    }
}
