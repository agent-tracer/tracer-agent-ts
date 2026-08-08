import { describe, expect, it } from "vitest";
import { CHAT_TOOL_ARGUMENT_REJECTION } from "~agent-worker/domain/chat/model/chat.tool.schema.js";
import { missingArgumentsOf } from "./chat.tool.support.js";

describe("확인 창구가 빠진 인자를 알린 응답", () => {
    it("그 자리를 읽어 낸다", () => {
        const raw = JSON.stringify({
            ok: false,
            error: { code: CHAT_TOOL_ARGUMENT_REJECTION.code, message: "x", details: { action: "create", missing: ["taskId"] } },
        });

        expect(missingArgumentsOf(raw)).toEqual({ action: "create", missing: ["taskId"] });
    });

    it("다른 코드로 거절한 응답은 이 갈래로 보내지 않는다", () => {
        const raw = JSON.stringify({ ok: false, error: { code: "bad_request", message: "x" } });

        expect(missingArgumentsOf(raw)).toBeNull();
    });

    it("봉투가 아닌 본문에 걸리지 않는다", () => {
        expect(missingArgumentsOf("not json")).toBeNull();
        expect(missingArgumentsOf(JSON.stringify({ ok: true, data: {} }))).toBeNull();
    });

    it("빠진 자리를 싣지 않은 거절은 읽어 내지 않는다", () => {
        const raw = JSON.stringify({ ok: false, error: { code: CHAT_TOOL_ARGUMENT_REJECTION.code, message: "x" } });

        expect(missingArgumentsOf(raw)).toBeNull();
    });
});
