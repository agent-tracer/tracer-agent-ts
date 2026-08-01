import { describe, expect, it } from "vitest";
import { TASK_CLEANUP_TOOL_NAMES } from "~agent-worker/domain/cleanup/model/cleanup.tool.schema.js";
import type {
    CleanupEventReaderPort,
    CleanupTaskReaderPort,
} from "~agent-worker/domain/cleanup/port/cleanup.reader.port.js";
import { buildCleanupToolHandlers } from "./cleanup.tools.js";

const tasks: CleanupTaskReaderPort = { findById: () => Promise.resolve(null) };
const events: CleanupEventReaderPort = {
    findTimeline: () => Promise.resolve([]),
    findTimelineWindow: () => Promise.resolve([]),
    countByTask: () => Promise.resolve(0),
};

describe("정리 제안 도구 핸들러", () => {
    it("계약이 선언한 도구 이름마다 핸들러를 세운다", () => {
        const handlers = buildCleanupToolHandlers("user-1", { tasks, events }, {
            candidates: [],
            batchTruncated: false,
        });

        expect(Object.keys(handlers).sort()).toEqual([...TASK_CLEANUP_TOOL_NAMES].sort());
    });
});
