import { beforeEach, describe, expect, it } from "vitest";
import { CLEANUP_SUGGESTION_STATUS } from "~agent-api/domain/cleanup/model/cleanup.const.js";
import {
    InMemoryCleanupSuggestionRepository,
    suggestionRow,
} from "~agent-api/domain/cleanup/port/__fakes__/cleanup.test-support.js";
import { ListCleanupSuggestionsUseCase } from "./list.cleanup.suggestions.usecase.js";

let suggestions: InMemoryCleanupSuggestionRepository;
let target: ListCleanupSuggestionsUseCase;

beforeEach(() => {
    suggestions = new InMemoryCleanupSuggestionRepository();
    target = new ListCleanupSuggestionsUseCase(suggestions);
});

describe("정리 제안을 상태로 걸러 조회한다", () => {
    it("상태를 실으면 그 상태의 제안만 낸다", async () => {
        suggestions.seed(
            suggestionRow({ id: "suggestion-1" }),
            suggestionRow({ id: "suggestion-2", status: CLEANUP_SUGGESTION_STATUS.dismissed, taskId: "task-2" }),
        );

        const result = await target.execute("local", CLEANUP_SUGGESTION_STATUS.dismissed);

        expect(result.suggestions.map((row) => row.id)).toEqual(["suggestion-2"]);
    });

    it("상태를 싣지 않으면 상태 선언 순서로 이어 붙인다", async () => {
        suggestions.seed(
            suggestionRow({ id: "suggestion-dismissed", status: CLEANUP_SUGGESTION_STATUS.dismissed, taskId: "task-3" }),
            suggestionRow({ id: "suggestion-pending", taskId: "task-1" }),
            suggestionRow({ id: "suggestion-accepted", status: CLEANUP_SUGGESTION_STATUS.accepted, taskId: "task-2" }),
        );

        const result = await target.execute("local");

        expect(result.suggestions.map((row) => row.id)).toEqual([
            "suggestion-pending",
            "suggestion-accepted",
            "suggestion-dismissed",
        ]);
    });

    it("대기 행은 태스크와 종류의 쌍으로 첫 행만 남긴다", async () => {
        suggestions.seed(
            suggestionRow({ id: "suggestion-new", createdAt: new Date("2026-01-02T00:00:00.000Z") }),
            suggestionRow({ id: "suggestion-old", createdAt: new Date("2026-01-01T00:00:00.000Z") }),
        );

        const result = await target.execute("local", CLEANUP_SUGGESTION_STATUS.pending);

        expect(result.suggestions.map((row) => row.id)).toEqual(["suggestion-new"]);
    });

    it("다른 상태의 행은 중복 제거 대상이 아니다", async () => {
        suggestions.seed(
            suggestionRow({ id: "suggestion-1", status: CLEANUP_SUGGESTION_STATUS.dismissed }),
            suggestionRow({ id: "suggestion-2", status: CLEANUP_SUGGESTION_STATUS.dismissed }),
        );

        const result = await target.execute("local", CLEANUP_SUGGESTION_STATUS.dismissed);

        expect(result.suggestions).toHaveLength(2);
    });

    it("남의 제안은 목록에 실리지 않는다", async () => {
        suggestions.seed(suggestionRow({ userId: "other" }));

        const result = await target.execute("local");

        expect(result.suggestions).toEqual([]);
    });
});
