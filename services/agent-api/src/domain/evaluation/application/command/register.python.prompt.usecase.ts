import { Inject, Injectable } from "@nestjs/common";
import { resolvePromptContentHash } from "~agent-api/domain/evaluation/model/prompt.hash.js";
import { PromptChannelAssignment, PromptDefinition, PromptVersion, type PromptVersionInput } from "~agent-api/domain/evaluation/model/prompt.model.js";
import { PROMPT_REPOSITORY, type PromptRepositoryPort } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
import { PROMPT_CLOCK, PROMPT_ID_GENERATOR, type PromptClockPort, type PromptIdGeneratorPort } from "~agent-api/domain/evaluation/port/prompt.runtime.port.js";

@Injectable()
export class RegisterPythonPromptUseCase {
    constructor(@Inject(PROMPT_REPOSITORY) private readonly repository: PromptRepositoryPort,
        @Inject(PROMPT_ID_GENERATOR) private readonly ids: PromptIdGeneratorPort,
        @Inject(PROMPT_CLOCK) private readonly clock: PromptClockPort) {}
    async execute(input: { userId: string; agentName: string; language: string; name: string; version: PromptVersionInput }) {
        const now = this.clock.now();
        const definition = Object.assign(new PromptDefinition(), { id: this.ids.next("prompt"), userId: input.userId,
            agentName: input.agentName, backend: "python", language: input.language, name: input.name, createdAt: now });
        const version = Object.assign(new PromptVersion(), { id: this.ids.next("prompt-version"), definitionId: definition.id,
            ...input.version, contentHash: resolvePromptContentHash(input.version.content, input.version.contentHash),
            contentOrigin: "file", createdBy: input.userId, createdAt: now });
        const channel = Object.assign(new PromptChannelAssignment(), { id: this.ids.next("channel"), definitionId: definition.id,
            channel: "production", versionId: version.id, updatedAt: now });
        await this.repository.registerPythonPrompt(input.userId, definition, version, channel);
        return { definition, version, channel };
    }
}
