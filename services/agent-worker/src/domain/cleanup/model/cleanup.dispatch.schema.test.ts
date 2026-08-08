import { describe, expect, it } from "vitest";
import {
    MAX_INSPECT_EXCERPTS,
    MAX_INSPECT_REASON_CHARS,
    salvageInspectReport,
} from "./cleanup.dispatch.schema.js";

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/u;

describe("상한을 넘긴 검토 보고", () => {
    it("판정 사유를 상한까지 잘라 세운다", () => {
        const report = salvageInspectReport("task-1", {
            archivable: true,
            reason: "가".repeat(MAX_INSPECT_REASON_CHARS + 40),
            citedEventIds: ["event-1"],
        });

        expect(report?.reason).toHaveLength(MAX_INSPECT_REASON_CHARS);
        expect(report?.citedEventIds).toEqual(["event-1"]);
    });

    it("인용 수를 상한까지 줄인다", () => {
        const report = salvageInspectReport("task-1", {
            archivable: true,
            reason: "판정",
            citedEventIds: Array.from({ length: MAX_INSPECT_EXCERPTS + 3 }, (_unused, index) => `event-${index}`),
        });

        expect(report?.citedEventIds).toHaveLength(MAX_INSPECT_EXCERPTS);
    });

    it("자르는 자리가 서로게이트 쌍을 가르지 않는다", () => {
        const report = salvageInspectReport("task-1", {
            archivable: false,
            reason: "🚀".repeat(MAX_INSPECT_REASON_CHARS),
        });

        expect(LONE_SURROGATE.test(report?.reason ?? "")).toBe(false);
    });

    it("맡은 후보를 보고가 잘못 적었어도 파견이 정한 후보로 세운다", () => {
        const report = salvageInspectReport("task-1", {
            taskId: "task-9",
            archivable: true,
            reason: "판정",
        });

        expect(report?.taskId).toBe("task-1");
    });

    it("상한 외의 이유로 어긋난 보고는 세우지 못한다", () => {
        expect(salvageInspectReport("task-1", { archivable: true, reason: "" })).toBeNull();
        expect(salvageInspectReport("task-1", { reason: "판정" })).toBeNull();
        expect(salvageInspectReport("task-1", null)).toBeNull();
        expect(salvageInspectReport("task-1", "판정")).toBeNull();
    });
});
