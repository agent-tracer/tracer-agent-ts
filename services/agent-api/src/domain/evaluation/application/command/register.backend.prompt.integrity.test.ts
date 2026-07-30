import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    FixedPromptClock, InMemoryPromptRepository, SequentialPromptIdGenerator,
} from "~agent-api/domain/evaluation/port/__fakes__/prompt.fakes.js";
import { RegisterBackendPromptUseCase } from "./register.backend.prompt.usecase.js";

interface IntegrityCase { readonly name: string; readonly content: string; readonly hash: string }
const { cases } = JSON.parse(
    readFileSync("contract/agent/shared/prompt.fragment.integrity.json", "utf8"),
) as { readonly cases: readonly IntegrityCase[] };

describe("RegisterBackendPromptUseCase", () => {
    it.each(cases.map((entry) => [entry.name, entry] as const))(
        "무결성 케이스 %s 의 해시를 계약과 같게 낸다",
        async (_name, entry) => {
            const { version } = await new RegisterBackendPromptUseCase(new InMemoryPromptRepository(),
                new SequentialPromptIdGenerator(), new FixedPromptClock(new Date(0)))
                .execute({ userId: "local", backend: "rust-agent", agentName: "task-cleanup", language: "en", name: "investigator",
                    version: { semanticVersion: "v1", content: entry.content, toolContractVersion: "1", outputSchemaVersion: "1" } });
            expect(version.contentHash).toBe(entry.hash);
        },
    );

    it("요청이 실은 해시가 규칙과 다르면 거절한다", async () => {
        await expect(new RegisterBackendPromptUseCase(new InMemoryPromptRepository(),
            new SequentialPromptIdGenerator(), new FixedPromptClock(new Date(0)))
            .execute({ userId: "local", backend: "rust-agent", agentName: "task-cleanup", language: "en", name: "investigator",
                version: { semanticVersion: "v1", content: "plain", contentHash: "0".repeat(64),
                    toolContractVersion: "1", outputSchemaVersion: "1" } })).rejects.toThrow();
    });
});
