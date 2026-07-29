import { Inject, Injectable } from "@nestjs/common";
import { extractFragmentPlaceholders, PromptFragmentChannelAssignment, PromptFragmentDefinition, PromptFragmentVersion } from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import { promptContentHash } from "~agent-api/domain/evaluation/model/prompt.hash.js";
import type { PromptBackend } from "~agent-api/domain/evaluation/model/prompt.model.js";
import { PROMPT_REPOSITORY, type PromptRepositoryPort } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
import { PROMPT_CLOCK, PROMPT_ID_GENERATOR, type PromptClockPort, type PromptIdGeneratorPort } from "~agent-api/domain/evaluation/port/prompt.runtime.port.js";

@Injectable()
export class RegisterCandidateFragmentVersionUseCase {
    constructor(@Inject(PROMPT_REPOSITORY) private readonly repository: PromptRepositoryPort,
        @Inject(PROMPT_ID_GENERATOR) private readonly ids: PromptIdGeneratorPort,
        @Inject(PROMPT_CLOCK) private readonly clock: PromptClockPort) {}
    async execute(input: { backend: PromptBackend; agentName: string; fragmentName: string; language: string;
        content: string; changeSummary: string | null; createdBy: string }) {
        const now = this.clock.now();
        const definition = Object.assign(new PromptFragmentDefinition(), { id: this.ids.next("fragment"),
            definitionKey: `${input.backend}.${input.agentName}.${input.fragmentName}`, agentName: input.agentName,
            backend: input.backend, language: input.language, fragmentName: input.fragmentName,
            codeName: input.fragmentName, createdAt: now });
        const version = Object.assign(new PromptFragmentVersion(), { id: this.ids.next("fragment-version"),
            definitionId: definition.id, semanticVersion: "candidate", content: input.content,
            contentHash: promptContentHash(input.content), placeholders: extractFragmentPlaceholders(input.content),
            toolContractVersion: "current", outputSchemaVersion: "current", origin: "database-authored",
            previousVersionId: null, changeSummary: input.changeSummary, createdBy: input.createdBy, createdAt: now });
        const channel = Object.assign(new PromptFragmentChannelAssignment(), { id: this.ids.next("fragment-channel"),
            definitionId: definition.id, channel: "candidate", versionId: version.id, updatedAt: now });
        await this.repository.saveCandidateFragment({ definition, version, channel });
        return { definitionId: definition.id, versionId: version.id, semanticVersion: version.semanticVersion };
    }
}
