import { describe, expect, it } from "vitest";
import { TITLE_SUGGESTION_TOOL_NAMES } from "~agent-worker/domain/title/model/title.tool.schema.js";
import type { TitleEventReaderPort } from "~agent-worker/domain/title/port/title.event.reader.port.js";
import { buildTitleToolHandlers } from "./title.tools.js";

const reader: TitleEventReaderPort = {
    taskExists: () => Promise.resolve(false),
    readTimeline: () => Promise.resolve([]),
    countByTask: () => Promise.resolve(0),
};

describe("제목 제안 도구 핸들러", () => {
    it("계약이 선언한 도구 이름마다 핸들러를 세운다", () => {
        expect(Object.keys(buildTitleToolHandlers("user-1", reader)).sort())
            .toEqual([...TITLE_SUGGESTION_TOOL_NAMES].sort());
    });
});
