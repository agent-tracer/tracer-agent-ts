import { describe, expect, it } from "vitest";
import { readContractJson } from "~agent-api/support/contract.js";
import {
    CHAT_REPLAY_MAX_MESSAGES,
    selectReplayMessages,
} from "~agent-api/domain/chat/model/chat.replay.spec.js";

interface DeclaredSummary {
    readonly production: { readonly trigger: { readonly messages: number } };
    readonly consumption: { readonly maxReplayMessages: number };
}

const DECLARED = readContractJson<DeclaredSummary>("agent/chat/summary.json");

function stored(count: number): { readonly id: string }[] {
    return Array.from({ length: count }, (_unused, index) => ({ id: `m-${index}` }));
}

describe("한 턴이 되돌려 주는 메시지의 절대 상한", () => {
    it("계약이 적은 수를 읽어 왔다", () => {
        expect(CHAT_REPLAY_MAX_MESSAGES).toBe(DECLARED.consumption.maxReplayMessages);
    });

    // 이 수가 트리거보다 작으면 정상 흐름이 늘 상한에 닿아 관측이 신호가 되지 못한다.
    it("요약 트리거보다 넉넉하다", () => {
        expect(CHAT_REPLAY_MAX_MESSAGES).toBeGreaterThan(DECLARED.production.trigger.messages);
    });

    // 요약이 없는 스레드에 상한이 없던 것이 이 검사가 막는 자리다.
    it("접은 지점이 없어도 상한을 넘겨 싣지 않는다", () => {
        expect(selectReplayMessages(stored(CHAT_REPLAY_MAX_MESSAGES + 20), null))
            .toHaveLength(CHAT_REPLAY_MAX_MESSAGES);
    });

    it("접은 지점이 없고 상한 안이면 이력을 그대로 싣는다", () => {
        const rows = stored(CHAT_REPLAY_MAX_MESSAGES - 1);

        expect(selectReplayMessages(rows, null)).toHaveLength(rows.length);
    });

    it("자를 때 최근 것을 남긴다", () => {
        const rows = stored(CHAT_REPLAY_MAX_MESSAGES + 1);

        expect(selectReplayMessages(rows, null).at(-1)?.id).toBe(rows.at(-1)?.id);
    });
});

describe("요약이 접은 지점", () => {
    it("그 지점 다음 메시지부터 싣는다", () => {
        const rows = stored(10);

        expect(selectReplayMessages(rows, "m-3").map((row) => row.id)).toEqual(
            rows.slice(4).map((row) => row.id),
        );
    });

    // 지점이 이 창에 없으면 그 요약이 이 이력을 덮지 않는다는 뜻이라 자르면 앞이 통째로 사라진다.
    it("지점을 못 찾으면 자르지 않는다", () => {
        const rows = stored(10);

        expect(selectReplayMessages(rows, "m-999")).toHaveLength(rows.length);
    });

    it("지점 뒤가 상한을 넘기면 최근 것만 싣는다", () => {
        const rows = stored(CHAT_REPLAY_MAX_MESSAGES + 30);

        expect(selectReplayMessages(rows, "m-0")).toHaveLength(CHAT_REPLAY_MAX_MESSAGES);
    });
});
