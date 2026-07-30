import { Inject, Injectable } from "@nestjs/common";
import { newFragmentChannel } from "~agent-api/domain/evaluation/model/prompt.fragment.policy.js";
import type { PromptChannel } from "~agent-api/domain/evaluation/model/prompt.model.js";
import { PROMPT_REPOSITORY, type PromptRepositoryPort } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
import { PROMPT_CLOCK, PROMPT_ID_GENERATOR, type PromptClockPort, type PromptIdGeneratorPort } from "~agent-api/domain/evaluation/port/prompt.runtime.port.js";

@Injectable()
export class PromotePromptFragmentUseCase {
    constructor(@Inject(PROMPT_REPOSITORY) private readonly repository: PromptRepositoryPort,
        @Inject(PROMPT_ID_GENERATOR) private readonly ids: PromptIdGeneratorPort,
        @Inject(PROMPT_CLOCK) private readonly clock: PromptClockPort) {}
    async execute(input: { definitionId: string; versionId: string; channel: PromptChannel }) {
        const version = await this.repository.findFragmentVersion(input.definitionId, input.versionId);
        if (version === null) throw new Error("Prompt fragment version not found");
        const current = await this.repository.findFragmentChannel(input.definitionId, input.channel);
        const channel = newFragmentChannel(current?.id ?? this.ids.next("fragment-channel"), input.definitionId,
            input.channel, version.id, this.clock.now());
        await this.repository.saveFragmentChannel(channel);
        return { definitionId: channel.definitionId, channel: channel.channel, versionId: channel.versionId };
    }
}
