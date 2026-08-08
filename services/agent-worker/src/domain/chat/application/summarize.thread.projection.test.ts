import type { IClock } from "@tracer-agent/platform";
import { describe, expect, it } from "vitest";
import { CHAT_MESSAGE_ROLE } from "~agent-worker/domain/chat/model/chat.const.js";
import { ChatMessage } from "~agent-worker/domain/chat/model/chat.message.model.js";
import { CHAT_SUMMARY_SPEC } from "~agent-worker/domain/chat/model/chat.summary.spec.js";
import { ChatThread } from "~agent-worker/domain/chat/model/chat.thread.model.js";
import type {
    ChatSummarizeRequest,
    ChatSummarizerPort,
} from "~agent-worker/domain/chat/port/chat.summarizer.port.js";
import type { ChatThreadRepositoryPort } from "~agent-worker/domain/chat/port/chat.repository.port.js";
import type { ChatSettingReaderPort } from "~agent-worker/domain/chat/port/setting.reader.port.js";
import { SummarizeThreadProjection } from "./summarize.thread.projection.js";

const NOW = new Date("2026-01-01T00:00:00Z");
const CLOCK: IClock = { now: () => NOW, nowMs: () => NOW.getTime(), nowIso: () => NOW.toISOString() };

function thread(summary: string | null = null): ChatThread {
    const made = new ChatThread();
    made.id = "thread";
    made.userId = "user";
    made.title = "제목";
    made.summary = summary;
    made.implementation = null;
    made.createdAt = NOW;
    made.updatedAt = NOW;
    return made;
}

function messages(count: number, content = "본문"): readonly ChatMessage[] {
    return Array.from({ length: count }, (_unused, index) =>
        ChatMessage.create({
            id: `message-${index}`,
            threadId: "thread",
            role: index % 2 === 0 ? CHAT_MESSAGE_ROLE.user : CHAT_MESSAGE_ROLE.assistant,
            content,
            now: NOW,
        }),
    );
}

function summarizerOf(
    answer: string | (() => Promise<string>),
    requiresKey = false,
): { port: ChatSummarizerPort; seen: ChatSummarizeRequest[] } {
    const seen: ChatSummarizeRequest[] = [];
    return {
        seen,
        port: {
            requiresLocalApiKey: () => requiresKey,
            summarize: async (request) => {
                seen.push(request);
                return typeof answer === "string" ? Promise.resolve(answer) : answer();
            },
        },
    };
}

function threadsOf(): { port: ChatThreadRepositoryPort; saved: ChatThread[] } {
    const saved: ChatThread[] = [];
    return {
        saved,
        port: {
            findById: async () => Promise.resolve(null),
            update: async (updated) => {
                saved.push(updated);
                return Promise.resolve();
            },
        },
    };
}

function settingsOf(value: string | null): ChatSettingReaderPort {
    return { findValue: async () => Promise.resolve(value) };
}

describe("대화를 요약으로 접는 단계", () => {
    it("문턱을 넘지 않은 스레드는 모델을 부르지 않는다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf("요약");

        await new SummarizeThreadProjection(threads.port, summarizer.port, CLOCK, settingsOf(null)).project(
            thread(),
            messages(CHAT_SUMMARY_SPEC.triggerMessageCount),
        );

        expect(summarizer.seen).toHaveLength(0);
        expect(threads.saved).toHaveLength(0);
    });

    it("메시지 수가 문턱을 넘으면 요약을 적는다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf("  접은 요약  ");

        await new SummarizeThreadProjection(threads.port, summarizer.port, CLOCK, settingsOf(null)).project(
            thread(),
            messages(CHAT_SUMMARY_SPEC.triggerMessageCount + 1),
        );

        expect(threads.saved[0]?.summary).toBe("접은 요약");
    });

    it("누적 글자가 문턱을 넘어도 재생 창 안에 다 들어가면 접을 것이 없다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf("요약");
        const long = "가".repeat(CHAT_SUMMARY_SPEC.triggerCharBudget);

        await new SummarizeThreadProjection(threads.port, summarizer.port, CLOCK, settingsOf(null)).project(
            thread(),
            messages(2, long),
        );

        expect(summarizer.seen).toHaveLength(0);
        expect(threads.saved).toHaveLength(0);
    });

    it("메시지 수가 적어도 재생 창 밖이 생기고 글자가 문턱을 넘으면 요약한다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf("요약");
        const long = "가".repeat(CHAT_SUMMARY_SPEC.triggerCharBudget);

        await new SummarizeThreadProjection(threads.port, summarizer.port, CLOCK, settingsOf(null)).project(
            thread(),
            messages(CHAT_SUMMARY_SPEC.recentKeepCount + 2, long),
        );

        expect(threads.saved).toHaveLength(1);
    });

    it("최근 재생 창은 남기고 그보다 오래된 것만 접어 보낸다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf("요약");
        const total = CHAT_SUMMARY_SPEC.triggerMessageCount + 1;

        await new SummarizeThreadProjection(threads.port, summarizer.port, CLOCK, settingsOf(null)).project(
            thread(),
            messages(total),
        );

        // 접어 보낸 메시지는 전체에서 재생 창에 남은 턴을 뺀 만큼이다.
        expect(summarizer.seen).toHaveLength(1);
        expect(threads.saved).toHaveLength(1);
    });

    it("앞선 요약이 있으면 그것까지 실어 이어 붙인다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf("새 요약");

        await new SummarizeThreadProjection(threads.port, summarizer.port, CLOCK, settingsOf(null)).project(
            thread("앞선 요약"),
            messages(CHAT_SUMMARY_SPEC.triggerMessageCount + 1),
        );

        expect(summarizer.seen[0]?.prompt).toContain("앞선 요약");
    });

    it("러너가 자격을 요구하면 사용자 키를 실어 보낸다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf("요약", true);

        await new SummarizeThreadProjection(
            threads.port,
            summarizer.port,
            CLOCK,
            settingsOf("sk-user-key"),
        ).project(thread(), messages(CHAT_SUMMARY_SPEC.triggerMessageCount + 1));

        expect(summarizer.seen[0]?.apiKey).toBe("sk-user-key");
    });

    it("요약하다 실패해도 턴을 막지 않는다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf(() => Promise.reject(new Error("모델이 응답하지 않았다")));

        const projecting = new SummarizeThreadProjection(
            threads.port,
            summarizer.port,
            CLOCK,
            settingsOf(null),
        ).project(thread(), messages(CHAT_SUMMARY_SPEC.triggerMessageCount + 1));

        await expect(projecting).resolves.toBeUndefined();
        expect(threads.saved).toHaveLength(0);
    });
});
