import { describe, expect, it } from "vitest";
import { CHAT_REPLAY_RECENT_KEEP_COUNT, selectReplayMessages } from "./chat.replay.spec.js";

function turns(count: number): { role: string }[] {
    return Array.from({ length: count }, () => ({ role: "user" }));
}

describe("selectReplayMessages", () => {
    it("요약이 없으면 창을 자르지 않는다", () => {
        expect(selectReplayMessages(turns(30), false)).toHaveLength(30);
    });

    it("요약이 있으면 최근 대화 턴만 남긴다", () => {
        expect(selectReplayMessages(turns(30), true)).toHaveLength(CHAT_REPLAY_RECENT_KEEP_COUNT);
    });

    it("도구 결과는 대화 턴으로 세지 않는다", () => {
        const messages = [
            ...turns(CHAT_REPLAY_RECENT_KEEP_COUNT),
            { role: "tool" },
            { role: "tool" },
        ];

        expect(selectReplayMessages(messages, true)).toHaveLength(messages.length);
    });
});
