import { Inject, Injectable } from "@nestjs/common";
import { resolvePromptContentHash } from "~agent-api/domain/evaluation/model/prompt.hash.js";
import { PromptVersion, type PromptVersionInput } from "~agent-api/domain/evaluation/model/prompt.model.js";
import { PROMPT_REPOSITORY, type PromptRepositoryPort } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
import { PROMPT_CLOCK, PROMPT_ID_GENERATOR, type PromptClockPort, type PromptIdGeneratorPort } from "~agent-api/domain/evaluation/port/prompt.runtime.port.js";

@Injectable()
export class CreatePromptVersionUseCase {
    constructor(@Inject(PROMPT_REPOSITORY) private readonly repository: PromptRepositoryPort,
        @Inject(PROMPT_ID_GENERATOR) private readonly ids: PromptIdGeneratorPort,
        @Inject(PROMPT_CLOCK) private readonly clock: PromptClockPort) {}
    async execute(input: { userId: string; definitionId: string; version: PromptVersionInput }) {
        if (!await this.repository.findPromptDefinition(input.userId, input.definitionId)) throw new Error("Prompt definition not found");
        const version = Object.assign(new PromptVersion(), { id: this.ids.next("prompt-version"), definitionId: input.definitionId,
            ...input.version, contentHash: resolvePromptContentHash(input.version.content, input.version.contentHash),
            contentOrigin: "user-authored", createdBy: input.userId, createdAt: this.clock.now() });
        await this.repository.savePromptVersion(input.userId, version);
        return version;
    }
}
