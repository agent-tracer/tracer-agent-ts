import type { IClock } from "@tracer-agent/platform";
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "~agent-worker/domain/chat/model/chat.message.model.js";
import { ChatThread } from "~agent-worker/domain/chat/model/chat.thread.model.js";
import {
    CHAT_DEFAULT_THREAD_TITLE,
    CHAT_TITLE_MAX_LENGTH,
} from "~agent-worker/domain/chat/model/chat.title.spec.js";
import type {
    ChatSummarizeRequest,
    ChatSummarizerPort,
} from "~agent-worker/domain/chat/port/chat.summarizer.port.js";
import type { ChatThreadRepositoryPort } from "~agent-worker/domain/chat/port/chat.repository.port.js";
import type { ChatSettingReaderPort } from "~agent-worker/domain/chat/port/setting.reader.port.js";
import { GenerateThreadTitleProjection } from "./generate.thread.title.projection.js";

const NOW = new Date("2026-01-01T00:00:00Z");

function threadWith(title: string): ChatThread {
    const thread = new ChatThread();
    thread.id = "thread";
    thread.userId = "user";
    thread.title = title;
    thread.summary = null;
    thread.implementation = null;
    thread.createdAt = NOW;
    thread.updatedAt = NOW;
    return thread;
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
            update: async (thread) => {
                saved.push(thread);
                return Promise.resolve();
            },
        },
    };
}

function settingsOf(value: string | null): ChatSettingReaderPort {
    return { findValue: async () => Promise.resolve(value) };
}

const CLOCK: IClock = { now: () => NOW, nowMs: () => NOW.getTime(), nowIso: () => NOW.toISOString() };
const MESSAGES: readonly ChatMessage[] = [];

describe("스레드 제목을 붙이는 단계", () => {
    it("기본 제목인 스레드에만 제목을 붙여 원장에 적는다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf("배포 파이프라인 고치기");

        await new GenerateThreadTitleProjection(threads.port, summarizer.port, CLOCK, settingsOf(null)).project(
            threadWith(CHAT_DEFAULT_THREAD_TITLE),
            MESSAGES,
        );

        expect(threads.saved[0]?.title).toBe("배포 파이프라인 고치기");
    });

    it("사용자가 이미 붙인 제목은 덮어쓰지 않는다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf("모델이 지은 제목");

        await new GenerateThreadTitleProjection(threads.port, summarizer.port, CLOCK, settingsOf(null)).project(
            threadWith("내가 붙인 제목"),
            MESSAGES,
        );

        expect(threads.saved).toHaveLength(0);
        expect(summarizer.seen).toHaveLength(0);
    });

    it("상한을 넘긴 제목은 상한까지만 적는다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf("가".repeat(CHAT_TITLE_MAX_LENGTH + 20));

        await new GenerateThreadTitleProjection(threads.port, summarizer.port, CLOCK, settingsOf(null)).project(
            threadWith(CHAT_DEFAULT_THREAD_TITLE),
            MESSAGES,
        );

        expect(threads.saved[0]?.title).toHaveLength(CHAT_TITLE_MAX_LENGTH);
    });

    it("공백뿐인 제목은 적지 않는다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf("   ");

        await new GenerateThreadTitleProjection(threads.port, summarizer.port, CLOCK, settingsOf(null)).project(
            threadWith(CHAT_DEFAULT_THREAD_TITLE),
            MESSAGES,
        );

        expect(threads.saved).toHaveLength(0);
    });

    it("러너가 자격을 요구하면 사용자 키를 실어 보낸다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf("제목", true);

        await new GenerateThreadTitleProjection(
            threads.port,
            summarizer.port,
            CLOCK,
            settingsOf("sk-user-key"),
        ).project(threadWith(CHAT_DEFAULT_THREAD_TITLE), MESSAGES);

        expect(summarizer.seen[0]?.apiKey).toBe("sk-user-key");
    });

    it("자격이 없어도 턴을 막지 않고 제목만 포기한다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf("제목", true);

        const projecting = new GenerateThreadTitleProjection(
            threads.port,
            summarizer.port,
            CLOCK,
            settingsOf(null),
        ).project(threadWith(CHAT_DEFAULT_THREAD_TITLE), MESSAGES);

        await expect(projecting).resolves.toBeUndefined();
        expect(threads.saved).toHaveLength(0);
    });

    it("제목을 짓다 실패해도 턴을 막지 않는다", async () => {
        const threads = threadsOf();
        const summarizer = summarizerOf(() => Promise.reject(new Error("모델이 응답하지 않았다")));

        const projecting = new GenerateThreadTitleProjection(
            threads.port,
            summarizer.port,
            CLOCK,
            settingsOf(null),
        ).project(threadWith(CHAT_DEFAULT_THREAD_TITLE), MESSAGES);

        await expect(projecting).resolves.toBeUndefined();
        expect(threads.saved).toHaveLength(0);
    });
});
