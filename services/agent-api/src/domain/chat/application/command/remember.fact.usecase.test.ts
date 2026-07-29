import { describe, expect, it } from "vitest";
import { FixedClock } from "~agent-api/domain/chat/port/__fakes__/fixed.clock.js";
import { InMemoryChatUserMemoryRepository } from "~agent-api/domain/chat/port/__fakes__/in-memory.chat.user.memory.repository.js";
import { SequentialChatIdGenerator } from "~agent-api/domain/chat/port/__fakes__/sequential.chat.id.generator.js";
import { RememberFactUseCase } from "./remember.fact.usecase.js";

const NOW = new Date("2026-01-01T00:00:00.000Z");

function makeUseCase(): { useCase: RememberFactUseCase; memories: InMemoryChatUserMemoryRepository } {
    const memories = new InMemoryChatUserMemoryRepository();
    return {
        useCase: new RememberFactUseCase(memories, new FixedClock(NOW), new SequentialChatIdGenerator()),
        memories,
    };
}

describe("RememberFactUseCase", () => {
    it("사실 하나를 확인 대기 없이 즉시 적재한다", async () => {
        const { useCase, memories } = makeUseCase();

        const remembered = await useCase.execute({ userId: "local", key: "editor", content: "vim을 쓴다" });

        expect(remembered).toEqual({ key: "editor", content: "vim을 쓴다", status: "remembered" });
        expect(await memories.listByUser("local")).toHaveLength(1);
    });

    it("같은 키의 사실을 덮어쓴다", async () => {
        const { useCase, memories } = makeUseCase();
        await useCase.execute({ userId: "local", key: "editor", content: "vim을 쓴다" });

        await useCase.execute({ userId: "local", key: "editor", content: "emacs를 쓴다" });

        const rows = await memories.listByUser("local");
        expect(rows).toHaveLength(1);
        expect(rows[0]!.content).toBe("emacs를 쓴다");
    });
});
