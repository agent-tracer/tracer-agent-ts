import { Inject, Injectable } from "@nestjs/common";
import { PromptChannelAssignment, PromptPromotion, type PromptChannel } from "~agent-api/domain/evaluation/model/prompt.model.js";
import { evaluatePromotionGate } from "~agent-api/domain/evaluation/model/prompt.promotion.policy.js";
import { PROMPT_REPOSITORY, type PromptRepositoryPort } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
import { PROMPT_CLOCK, PROMPT_ID_GENERATOR, type PromptClockPort, type PromptIdGeneratorPort } from "~agent-api/domain/evaluation/port/prompt.runtime.port.js";

@Injectable()
export class PromotePromptUseCase {
    constructor(@Inject(PROMPT_REPOSITORY) private readonly repository: PromptRepositoryPort,
        @Inject(PROMPT_ID_GENERATOR) private readonly ids: PromptIdGeneratorPort,
        @Inject(PROMPT_CLOCK) private readonly clock: PromptClockPort) {}
    async execute(input: { userId: string; definitionId: string; versionId: string; channel: PromptChannel; experimentId: string }) {
        const version = await this.repository.findPromptVersion(input.userId, input.versionId);
        if (version?.definitionId !== input.definitionId) throw new Error("Prompt version not found");
        const staging = await this.repository.findPromptChannel(input.userId, input.definitionId, "staging");
        const gate = evaluatePromotionGate({ channel: input.channel, versionId: version.id,
            stagingVersionId: staging?.versionId ?? null });
        if (!gate.passed) throw new Error(`Prompt promotion gate failed: ${gate.reasons.join(", ")}`);
        const now = this.clock.now();
        const current = await this.repository.findPromptChannel(input.userId, input.definitionId, input.channel);
        const channel = Object.assign(new PromptChannelAssignment(), { id: current?.id ?? this.ids.next("channel"),
            definitionId: input.definitionId, channel: input.channel, versionId: version.id, updatedAt: now });
        const promotion = Object.assign(new PromptPromotion(), { id: this.ids.next("promotion"), userId: input.userId,
            promptVersionId: version.id, experimentId: input.experimentId, fromChannel: current?.channel ?? null,
            toChannel: input.channel, gateResult: { ...gate }, promotedBy: input.userId, promotedAt: now });
        await this.repository.savePromptChannel(input.userId, channel, promotion);
        return { channel, promotion };
    }
}
