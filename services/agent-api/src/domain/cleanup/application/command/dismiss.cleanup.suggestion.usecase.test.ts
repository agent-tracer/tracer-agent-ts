import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { CLEANUP_SUGGESTION_STATUS } from "~agent-api/domain/cleanup/model/cleanup.const.js";
import {
    FixedClock,
    InMemoryCleanupSuggestionRepository,
    suggestionRow,
} from "~agent-api/domain/cleanup/port/__fakes__/cleanup.test-support.js";
import { DismissCleanupSuggestionUseCase } from "./dismiss.cleanup.suggestion.usecase.js";

const NOW = new Date("2026-02-01T00:00:00.000Z");

let suggestions: InMemoryCleanupSuggestionRepository;
let target: DismissCleanupSuggestionUseCase;

beforeEach(() => {
    suggestions = new InMemoryCleanupSuggestionRepository();
    target = new DismissCleanupSuggestionUseCase(suggestions, new FixedClock(NOW));
});

describe("정리 제안을 기각한다", () => {
    it("상태를 dismissed 로 옮기고 해소 시각을 적는다", async () => {
        suggestions.seed(suggestionRow());

        const result = await target.execute("local", "suggestion-1");

        expect({ status: result.suggestion.status, resolvedAt: result.suggestion.resolvedAt }).toEqual({
            status: CLEANUP_SUGGESTION_STATUS.dismissed,
            resolvedAt: NOW.toISOString(),
        });
    });

    it("이미 해소된 제안의 기각을 cleanup.not-pending 으로 거절한다", async () => {
        suggestions.seed(suggestionRow({ status: CLEANUP_SUGGESTION_STATUS.accepted }));

        await expect(target.execute("local", "suggestion-1")).rejects.toMatchObject({
            code: "cleanup.not-pending",
        });
    });

    it("남의 제안은 없는 것과 같은 404 로 감춘다", async () => {
        suggestions.seed(suggestionRow({ userId: "other" }));

        await expect(target.execute("local", "suggestion-1")).rejects.toBeInstanceOf(NotFoundException);
    });
});
