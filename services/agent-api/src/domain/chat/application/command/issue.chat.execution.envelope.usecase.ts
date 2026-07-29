import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { featureLimits, featureModels, wireModelRates } from "@tracer-agent/llm";
import { CHAT_FEATURE } from "~agent-api/domain/chat/model/chat.const.js";
import { ChatMissingApiKeyError } from "~agent-api/domain/chat/model/chat.errors.js";
import type { ChatExecutionEnvelope } from "~agent-api/domain/chat/model/chat.execution.envelope.js";
import { CHAT_DRAFT_TOKEN, type ChatDraftTokenPort } from "~agent-api/domain/chat/port/chat.draft.token.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    type ChatExecutionRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";
import { CHAT_SCOPE_TOKEN, type ChatScopeTokenPort } from "~agent-api/domain/chat/port/chat.scope.token.port.js";
import {
    CHAT_AGENT_API_BASE_URL,
    CHAT_TRACER_API_BASE_URL,
    type ChatAgentApiBaseUrlPort,
    type ChatTracerApiBaseUrlPort,
} from "~agent-api/domain/chat/port/chat.tracer.api.port.js";
import { CHAT_CLOCK, type ClockPort } from "~agent-api/domain/chat/port/clock.port.js";
import { CHAT_SETTING_READER, type ChatSettingReaderPort } from "~agent-api/domain/chat/port/setting.reader.port.js";
import { CHAT_TOOL_CONTRACT } from "~agent-api/domain/chat/model/chat.tool.schema.js";

/** 사용자 설정에서 모델 자격을 찾는 키다. */
export const CHAT_API_KEY_SETTING = "anthropic.api_key";

/** 실행기가 카탈로그도 자격도 지어내지 않도록, 한 시도가 쓸 값 전부를 이 서비스가 만들어 건넨다. */
@Injectable()
export class IssueChatExecutionEnvelopeUseCase {
    constructor(
        @Inject(CHAT_EXECUTION_REPOSITORY) private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_SETTING_READER) private readonly settings: ChatSettingReaderPort,
        @Inject(CHAT_DRAFT_TOKEN) private readonly draftTokens: ChatDraftTokenPort,
        @Inject(CHAT_SCOPE_TOKEN) private readonly scopeTokens: ChatScopeTokenPort,
        @Inject(CHAT_TRACER_API_BASE_URL) private readonly tracerApiBaseUrl: ChatTracerApiBaseUrlPort,
        @Inject(CHAT_AGENT_API_BASE_URL) private readonly agentApiBaseUrl: ChatAgentApiBaseUrlPort,
        @Inject(CHAT_CLOCK) private readonly clock: ClockPort,
    ) {}

    async execute(executionId: string): Promise<ChatExecutionEnvelope> {
        const execution = await this.executions.findById(executionId);
        if (execution === null) throw new NotFoundException("Chat execution not found");
        const apiKey = await this.settings.findByScopeAndKey(execution.userId, CHAT_API_KEY_SETTING);
        if (apiKey === null || apiKey.length === 0) throw new ChatMissingApiKeyError();

        const limits = featureLimits(CHAT_FEATURE);
        const grant = this.draftTokens.issue();
        return {
            model: execution.model ?? featureModels(CHAT_FEATURE)!.default,
            apiKey,
            modelRates: wireModelRates(),
            limits: {
                budgetUsd: limits.budgetUsd,
                maxTurns: limits.maxTurns,
                maxOutputTokens: limits.maxOutputTokens,
            },
            deadlineMs: limits.deadlineMs,
            readApiBaseUrl: this.tracerApiBaseUrl,
            // 서명 비밀이 없는 환경에서는 자격이 비고, 도구 호출은 자기신고 헤더로만 식별된다.
            scopeToken: this.scopeTokens.issue(
                { userId: execution.userId, executionId },
                this.clock.now(),
            ) ?? "",
            toolDescriptions: CHAT_TOOL_CONTRACT.descriptions,
            draft: {
                url: new URL(
                    `/api/v1/chat/executions/${encodeURIComponent(executionId)}/drafts`,
                    this.agentApiBaseUrl,
                ).toString(),
                token: grant.token,
                tokenHash: grant.hash,
            },
        };
    }
}
