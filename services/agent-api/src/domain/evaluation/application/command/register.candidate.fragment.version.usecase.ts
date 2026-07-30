import { Inject, Injectable } from "@nestjs/common";
import { PromptFragmentChannelAssignment } from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import { authoredFragmentVersion, nextCandidateFragmentVersion } from "~agent-api/domain/evaluation/model/prompt.fragment.policy.js";
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
        const definition = await this.repository.findFragmentDefinition({
            backend: input.backend, agentName: input.agentName,
            fragmentName: input.fragmentName, language: input.language,
        });
        if (definition === null) throw new Error("Prompt fragment definition not found");
        const versions = await this.repository.listFragmentVersions(definition.id);
        const baseline = versions.find((item) => item.origin === "code-default");
        if (baseline === undefined) throw new Error("Prompt fragment code default not found");
        const now = this.clock.now();
        const version = authoredFragmentVersion({ ...nextCandidateFragmentVersion(versions),
            id: this.ids.next("fragment-version"), definitionId: definition.id, content: input.content,
            changeSummary: input.changeSummary, createdBy: input.createdBy,
            toolContractVersion: baseline.toolContractVersion, outputSchemaVersion: baseline.outputSchemaVersion, now });
        const channel = Object.assign(new PromptFragmentChannelAssignment(), { id: this.ids.next("fragment-channel"),
            definitionId: definition.id, channel: "candidate", versionId: version.id, updatedAt: now });
        await this.repository.saveCandidateFragmentVersion({ version, channel });
        return { definitionId: definition.id, versionId: version.id, semanticVersion: version.semanticVersion };
    }
}
