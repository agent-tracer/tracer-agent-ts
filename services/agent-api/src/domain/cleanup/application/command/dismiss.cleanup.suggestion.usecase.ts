import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { CLEANUP_CLOCK, type ClockPort } from "~agent-api/domain/cleanup/port/clock.port.js";
import {
    CLEANUP_SUGGESTION_REPOSITORY,
    type CleanupSuggestionRepositoryPort,
} from "~agent-api/domain/cleanup/port/cleanup.repository.port.js";
import {
    mapCleanupSuggestion,
    type CleanupSuggestionDto,
} from "~agent-api/domain/cleanup/application/cleanup.support.js";

/** 제안을 기각하며 태스크를 건드리지 않으므로 추적을 부르지 않는다. */
@Injectable()
export class DismissCleanupSuggestionUseCase {
    constructor(
        @Inject(CLEANUP_SUGGESTION_REPOSITORY) private readonly suggestions: CleanupSuggestionRepositoryPort,
        @Inject(CLEANUP_CLOCK) private readonly clock: ClockPort,
    ) {}

    async execute(userId: string, id: string): Promise<{ readonly suggestion: CleanupSuggestionDto }> {
        const suggestion = await this.suggestions.findById(id);
        // 남의 제안은 존재 자체를 알리지 않는다.
        if (suggestion === null || !suggestion.isOwnedBy(userId)) {
            throw new NotFoundException("Cleanup suggestion not found");
        }
        suggestion.dismiss(this.clock.now());
        await this.suggestions.upsert(suggestion);
        return { suggestion: mapCleanupSuggestion(suggestion) };
    }
}
