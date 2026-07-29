import { Inject, Injectable } from "@nestjs/common";
import { resolvePromptContentHash } from "~agent-api/domain/evaluation/model/prompt.hash.js";
import { PromptDefinition, PromptVersion, type PromptBackend, type PromptVersionInput } from "~agent-api/domain/evaluation/model/prompt.model.js";
import { PROMPT_REPOSITORY, type PromptRepositoryPort } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
import { PROMPT_CLOCK, PROMPT_ID_GENERATOR, type PromptClockPort, type PromptIdGeneratorPort } from "~agent-api/domain/evaluation/port/prompt.runtime.port.js";

@Injectable()
export class CreatePromptUseCase {
    constructor(@Inject(PROMPT_REPOSITORY) private readonly repository: PromptRepositoryPort,
        @Inject(PROMPT_ID_GENERATOR) private readonly ids: PromptIdGeneratorPort,
        @Inject(PROMPT_CLOCK) private readonly clock: PromptClockPort) {}
    async execute(input: { userId: string; name: string; agentName: string; backend: PromptBackend; language: string; version: PromptVersionInput }) {
        const now = this.clock.now();
        const definition = Object.assign(new PromptDefinition(), { id: this.ids.next("prompt"), userId: input.userId, name: input.name,
            agentName: input.agentName, backend: input.backend, language: input.language, createdAt: now });
        const version = Object.assign(new PromptVersion(), { id: this.ids.next("prompt-version"), definitionId: definition.id,
            ...input.version, contentHash: resolvePromptContentHash(input.version.content, input.version.contentHash),
            contentOrigin: "user-authored", createdBy: input.userId, createdAt: now });
        await this.repository.savePrompt(definition, version);
        return { definition, version };
    }
}
