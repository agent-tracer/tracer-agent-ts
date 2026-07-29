import { describe, expect, it } from "vitest";
import {
    readEvidenceArray,
    readEvidenceObject,
    toSnapshotEvent,
    toSnapshotRule,
    toSnapshotTask,
    type EvidenceEvent,
    type EvidenceRule,
} from "./evaluation.snapshot.model.js";

describe("readEvidenceArray", () => {
    it("배열이면 그대로 읽는다", () => {
        expect(readEvidenceArray({ get_task_events: [1, 2] }, "get_task_events")).toEqual([1, 2]);
    });

    it("키가 없거나 배열이 아니면 빈 배열을 낸다", () => {
        expect(readEvidenceArray({}, "get_task_events")).toEqual([]);
        expect(readEvidenceArray({ get_task_events: "x" }, "get_task_events")).toEqual([]);
    });
});

describe("readEvidenceObject", () => {
    it("평범한 객체면 그대로 읽는다", () => {
        expect(readEvidenceObject<{ a: number }>({ task: { a: 1 } }, "task")).toEqual({ a: 1 });
    });

    it("배열이거나 없으면 null을 낸다", () => {
        expect(readEvidenceObject({ task: [1] }, "task")).toBeNull();
        expect(readEvidenceObject({}, "task")).toBeNull();
    });
});

describe("toSnapshotEvent", () => {
    it("선택 필드가 없으면 null과 빈 배열로 채운다", () => {
        const event: EvidenceEvent = { id: "e1", seq: "1", kind: "tool_call", title: "실행", occurredAt: "2024-01-01T00:00:00.000Z" };
        expect(toSnapshotEvent(event)).toMatchObject({ turnId: null, body: null, toolName: null, filePaths: [] });
    });
});

describe("toSnapshotTask", () => {
    it("evidence가 없으면 taskId를 id로 쓰고 기본 상태를 채운다", () => {
        const task = toSnapshotTask("t1", null);
        expect(task).toMatchObject({ id: "t1", title: "", status: "running", taskKind: "primary" });
    });

    it("evidence가 있으면 그 값을 우선한다", () => {
        const task = toSnapshotTask("t1", { id: "t1", title: "제목", status: "archived" });
        expect(task).toMatchObject({ title: "제목", status: "archived" });
    });
});

describe("toSnapshotRule", () => {
    it("선택 필드가 없으면 기본값으로 채운다", () => {
        const rule: EvidenceRule = {
            id: "r1", name: "규칙", expectation: { kind: "action", tool: "bash" },
            taskId: "t1", anchorEventId: "e1", source: "system", severity: "warn", signature: "sig",
        };
        const result = toSnapshotRule(rule);
        expect(result.rationale).toBeNull();
        expect(result.createdAt).toBeInstanceOf(Date);
    });
});
