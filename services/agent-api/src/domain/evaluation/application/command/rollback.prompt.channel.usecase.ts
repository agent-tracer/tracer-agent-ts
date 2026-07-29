import { Inject, Injectable } from "@nestjs/common";
import { PromptChannelAssignment, PromptPromotion, type PromptChannel } from "~agent-api/domain/evaluation/model/prompt.model.js";
import { PROMPT_REPOSITORY, type PromptRepositoryPort } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
import { PROMPT_CLOCK, PROMPT_ID_GENERATOR, type PromptClockPort, type PromptIdGeneratorPort } from "~agent-api/domain/evaluation/port/prompt.runtime.port.js";

@Injectable()
export class RollbackPromptChannelUseCase {
    constructor(@Inject(PROMPT_REPOSITORY) private readonly repository: PromptRepositoryPort,
        @Inject(PROMPT_ID_GENERATOR) private readonly ids: PromptIdGeneratorPort,
        @Inject(PROMPT_CLOCK) private readonly clock: PromptClockPort) {}
    async execute(input: { userId: string; definitionId: string; versionId: string; channel: PromptChannel }) {
        const version = await this.repository.findPromptVersion(input.userId, input.versionId);
        const current = await this.repository.findPromptChannel(input.userId, input.definitionId, input.channel);
        if (version?.definitionId !== input.definitionId || !current) throw new Error("Prompt channel not found");
        const now = this.clock.now();
        const channel = Object.assign(new PromptChannelAssignment(), { ...current, versionId: version.id, updatedAt: now });
        const promotion = Object.assign(new PromptPromotion(), { id: this.ids.next("promotion"), userId: input.userId,
            promptVersionId: version.id, experimentId: null, fromChannel: input.channel, toChannel: input.channel,
            gateResult: { rollback: true }, promotedBy: input.userId, promotedAt: now });
        await this.repository.savePromptChannel(input.userId, channel, promotion);
        return { channel, promotion };
    }
}
