import { describe, expect, it } from "vitest";
import { inspectReportSchema } from "./cleanup.dispatch.schema.js";
import { CLEANUP_TOOL_CONTRACT } from "./cleanup.tool.schema.js";

const DECLARED = CLEANUP_TOOL_CONTRACT.orchestration.workerReport.required;

/** 검토 전문가가 올린 보고 하나이며 계약이 채우라고 적은 칸을 전부 갖는다. */
const REPORT = {
    taskId: "task-1",
    archivable: true,
    reason: "이 태스크는 이벤트가 없고 마지막 활동이 오래됐다",
    citedEventIds: ["event-1"],
};

describe("계약이 적은 전문가 보고의 칸", () => {
    it("계약이 채워야 할 칸을 적어도 하나 적는다", () => {
        expect(DECLARED.length).toBeGreaterThan(0);
    });

    // 계약이 칸을 더하거나 지우면 이 축의 모양이 따라와야 하고, 따라오지 않으면 두 축이 다른 보고를 받는다.
    it("이 축의 보고 모양이 계약이 적은 칸과 같다", () => {
        expect(Object.keys(inspectReportSchema.shape).sort()).toEqual([...DECLARED].sort());
    });

    // required 는 보고가 갖는 칸의 이름이며 비어 있어도 되는 칸을 가리지 않으므로 그 구분은 스키마가 갖는다.
    it("계약이 적은 칸을 전부 채운 보고를 통과시킨다", () => {
        expect(inspectReportSchema.safeParse(REPORT).success).toBe(true);
    });

    it("근거 없는 보고를 거절한다", () => {
        expect(inspectReportSchema.safeParse({ ...REPORT, reason: "  " }).success).toBe(false);
    });
});
