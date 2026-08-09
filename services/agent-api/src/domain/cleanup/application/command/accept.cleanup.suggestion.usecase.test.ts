import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it } from "vitest";
import { CLEANUP_SUGGESTION_STATUS } from "~agent-api/domain/cleanup/model/cleanup.const.js";
import {
    FakeTaskArchiver,
    FixedClock,
    InMemoryCleanupSuggestionRepository,
    suggestionRow,
} from "~agent-api/domain/cleanup/port/__fakes__/cleanup.test-support.js";
import { AcceptCleanupSuggestionUseCase } from "./accept.cleanup.suggestion.usecase.js";

const OBSERVED_AT = new Date("2026-01-01T00:01:00.000Z");
const NOW = new Date("2026-02-01T00:00:00.000Z");

let suggestions: InMemoryCleanupSuggestionRepository;
let archiver: FakeTaskArchiver;
let target: AcceptCleanupSuggestionUseCase;

beforeEach(() => {
    suggestions = new InMemoryCleanupSuggestionRepository();
    archiver = new FakeTaskArchiver();
    target = new AcceptCleanupSuggestionUseCase(suggestions, archiver, new FixedClock(NOW));
});

describe("정리 제안을 수용한다", () => {
    it("제안을 accepted 로 적고 해소 시각을 적는다", async () => {
        suggestions.seed(suggestionRow());

        const result = await target.execute("local", "suggestion-1");

        expect({ status: result.suggestion.status, resolvedAt: result.suggestion.resolvedAt }).toEqual({
            status: CLEANUP_SUGGESTION_STATUS.accepted,
            resolvedAt: NOW.toISOString(),
        });
    });

    it("관측한 마지막 사건 시각을 조건으로 실어 보관을 부른다", async () => {
        suggestions.seed(suggestionRow());

        await target.execute("local", "suggestion-1");

        expect(archiver.calls).toEqual([
            { userId: "local", taskId: "task-1", ifNoActivitySince: OBSERVED_AT },
        ]);
    });

    it("조건과 같은 시각의 사건은 새 활동이 아니므로 수용이 선다", async () => {
        suggestions.seed(suggestionRow());
        archiver.seedLastEventAt("task-1", OBSERVED_AT);

        const result = await target.execute("local", "suggestion-1");

        expect(result.suggestion.status).toBe(CLEANUP_SUGGESTION_STATUS.accepted);
    });

    it("조건보다 뒤의 사건이 있으면 cleanup.stale 을 그대로 낸다", async () => {
        suggestions.seed(suggestionRow());
        archiver.seedLastEventAt("task-1", new Date("2026-01-01T00:02:00.000Z"));

        await expect(target.execute("local", "suggestion-1")).rejects.toMatchObject({
            code: "cleanup.stale",
            httpStatus: 409,
        });
    });

    it("거절을 받으면 수용을 되돌려 대기로 남긴다", async () => {
        suggestions.seed(suggestionRow());
        archiver.seedLastEventAt("task-1", new Date("2026-01-01T00:02:00.000Z"));

        await expect(target.execute("local", "suggestion-1")).rejects.toThrow();

        const stored = suggestions.stored("suggestion-1");
        expect({ status: stored?.status, resolvedAt: stored?.resolvedAt }).toEqual({
            status: CLEANUP_SUGGESTION_STATUS.pending,
            resolvedAt: null,
        });
    });

    it("이미 수용된 제안은 원장을 바꾸지 않고 보관만 다시 밟는다", async () => {
        const resolvedAt = new Date("2026-01-10T00:00:00.000Z");
        suggestions.seed(
            suggestionRow({ status: CLEANUP_SUGGESTION_STATUS.accepted, resolvedAt }),
        );

        const result = await target.execute("local", "suggestion-1");

        expect(result.suggestion.resolvedAt).toBe(resolvedAt.toISOString());
        expect(archiver.calls).toHaveLength(1);
    });

    it("화면이 한 번만 불러도 수용과 보관이 함께 일어난다", async () => {
        suggestions.seed(suggestionRow());

        await target.execute("local", "suggestion-1");

        expect(archiver.calls).toHaveLength(1);
    });

    it("남의 제안은 없는 것과 같은 404 로 감춘다", async () => {
        suggestions.seed(suggestionRow({ userId: "other" }));

        await expect(target.execute("local", "suggestion-1")).rejects.toBeInstanceOf(NotFoundException);
    });

    it("없는 제안도 같은 404 로 낸다", async () => {
        await expect(target.execute("local", "suggestion-없음")).rejects.toBeInstanceOf(NotFoundException);
    });
});
