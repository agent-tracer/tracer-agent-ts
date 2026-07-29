import { describe, expect, it } from "vitest";
import { ChatUserMemory } from "~agent-api/domain/chat/model/chat.user.memory.model.js";
import { InMemoryChatUserMemoryRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.user.memory.repository.js";
import { RecallFactsUseCase } from "./recall.facts.usecase.js";

describe("RecallFactsUseCase", () => {
    it("이 사용자의 기억만 최근순으로 준다", async () => {
        const memories = new InMemoryChatUserMemoryRepository();
        memories.seed(
            ChatUserMemory.create({ id: "1", userId: "local", key: "editor", content: "vim", now: new Date("2026-01-01T00:00:00.000Z") }),
            ChatUserMemory.create({ id: "2", userId: "local", key: "shell", content: "zsh", now: new Date("2026-01-02T00:00:00.000Z") }),
            ChatUserMemory.create({ id: "3", userId: "other", key: "editor", content: "nano", now: new Date("2026-01-03T00:00:00.000Z") }),
        );

        const { facts } = await new RecallFactsUseCase(memories).execute("local");

        expect(facts.map((fact) => fact.key)).toEqual(["shell", "editor"]);
    });

    it("기억이 없으면 빈 목록을 준다", async () => {
        const { facts } = await new RecallFactsUseCase(new InMemoryChatUserMemoryRepository()).execute("local");

        expect(facts).toEqual([]);
    });
});
