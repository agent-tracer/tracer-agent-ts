import { describe, expect, it } from "vitest";
import { CHAT_MESSAGE_ROLE } from "~agent-api/domain/chat/model/chat.const.js";
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

function turns(count: number): { readonly role: string }[] {
    return Array.from({ length: count }, () => ({ role: CHAT_MESSAGE_ROLE.user }));
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
    it("요약이 없어도 상한을 넘겨 싣지 않는다", () => {
        const kept = selectReplayMessages(turns(CHAT_REPLAY_MAX_MESSAGES + 20), false);

        expect(kept).toHaveLength(CHAT_REPLAY_MAX_MESSAGES);
    });

    it("요약이 없고 상한 안이면 이력을 그대로 싣는다", () => {
        const stored = turns(CHAT_REPLAY_MAX_MESSAGES - 1);

        expect(selectReplayMessages(stored, false)).toHaveLength(stored.length);
    });

    it("자를 때 최근 것을 남긴다", () => {
        const stored = [...turns(CHAT_REPLAY_MAX_MESSAGES), { role: CHAT_MESSAGE_ROLE.assistant }];

        expect(selectReplayMessages(stored, false).at(-1)?.role).toBe(CHAT_MESSAGE_ROLE.assistant);
    });
});
