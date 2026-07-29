import { describe, expect, it } from "vitest";
import { promptFixture } from "../prompt.test.fixture.js";
import { GetPromptChannelsUseCase } from "./get.prompt.channels.usecase.js";
describe("GetPromptChannelsUseCase", () => {
    it("정의의 채널 배치를 조회한다", async () => {
        const { repository, definition } = promptFixture();
        expect(await new GetPromptChannelsUseCase(repository).execute("user-1", definition.id)).toEqual([]);
    });
});
