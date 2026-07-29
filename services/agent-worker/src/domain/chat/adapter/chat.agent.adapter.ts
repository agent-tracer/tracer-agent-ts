import {
    AGENT_BACKEND,
    buildClaudeRunObservation,
    buildMcpToolServer,
    computeResolvedPromptBundleHash,
    mcpToolNames,
    stripMcpToolPrefix,
    verifyResolvedPromptBundleHash,
    withMcpToolPrefix,
    type AgentStreamSink,
    type ClaudeQueryOptions,
    type IQueryRunner,
    type JobStepPayload,
} from "@tracer-agent/llm";
import type { TracerApiClient } from "@tracer-agent/tracer-client";
import {
    buildChatSystemPrompt,
    renderChatPrompt,
} from "~agent-worker/domain/chat/model/chat.prompt.js";
import { CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY } from "~agent-worker/domain/chat/model/chat.prompt.fragments.js";
import { selectFinalChatText } from "~agent-worker/domain/chat/model/chat.response.js";
import { CHAT_SPEC } from "~agent-worker/domain/chat/model/chat.spec.js";
import { chatStopReason } from "~agent-worker/domain/chat/model/chat.stop.reason.js";
import type {
    ChatTurnInput,
    ChatTurnResult,
    ChatTurnSink,
} from "~agent-worker/domain/chat/model/chat.turn.model.js";
import type { ChatAgentPort } from "~agent-worker/domain/chat/port/chat.agent.port.js";
import type { ChatPromptFragmentSnapshotPort } from "~agent-worker/domain/chat/port/chat.prompt.fragment.snapshot.port.js";
import { buildChatMemoryToolHandlers } from "./chat.memory.tools.js";
import { buildChatReadToolHandlers } from "./chat.read.tools.js";
import { ChatWriteClient, buildChatWriteToolHandlers } from "./chat.write.tools.js";

export const CHAT_MCP_SERVER = `monitor-${CHAT_SPEC.name}`;

/** Claude Agent SDK 방언으로 대화 명세를 렌더링하고 러너의 스트림을 대화 싱크로 이어 준다. */
export class ChatAgentAdapter implements ChatAgentPort {
    constructor(
        private readonly runner: IQueryRunner<ClaudeQueryOptions>,
        private readonly tracerApi: TracerApiClient,
        private readonly memoryApi: TracerApiClient,
        private readonly agentApiBaseUrl: string,
        private readonly promptFragments: ChatPromptFragmentSnapshotPort,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.runner.requiresLocalApiKey();
    }

    async converse(input: ChatTurnInput, sink: ChatTurnSink): Promise<ChatTurnResult> {
        // 도구가 부르는 창구의 사용자 범위를 호출마다가 아니라 이 진입점을 만들 때 한 번 묶는다.
        const scope = { userId: input.userId, scopeToken: input.scopeToken };
        const writes = buildChatWriteToolHandlers(
            new ChatWriteClient(this.agentApiBaseUrl, input.threadId, input.userId, input.scopeToken),
        );
        const handlers = {
            ...buildChatReadToolHandlers(this.tracerApi, scope),
            ...buildChatMemoryToolHandlers(this.memoryApi, { ...scope, sink }),
            ...writes.handlers,
        };
        const model = input.model?.trim() || CHAT_SPEC.limits.defaultModel;

        // SDK 스트림은 동기 콜백이라 역압력을 상류로 전할 수 없어 통지를 기다리지 않고 흘려보낸다.
        const runnerStream: AgentStreamSink = {
            onProgress: () => sink.onProgress?.(),
            onAssistantDelta: (text) => {
                void sink.onAssistantDelta(text);
            },
            onToolCall: (call) => {
                void sink.onToolCall({ ...call, name: stripMcpToolPrefix(call.name) });
            },
            onToolResult: (result) => {
                void sink.onToolResult({ ...result, toolName: stripMcpToolPrefix(result.toolName) });
            },
        };

        const prompt = withMcpToolPrefix(
            renderChatPrompt(input.messages, input.summary, input.facts),
            CHAT_SPEC.toolNames,
            CHAT_MCP_SERVER,
        );
        const promptFragments = this.resolvePromptFragments(input);
        const resolvedSystemPrompt = buildChatSystemPrompt(input.language, promptFragments);
        const templates = { [CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY]: resolvedSystemPrompt };
        const { resolvedPromptHash, resolvedPromptHashes } = computeResolvedPromptBundleHash(templates);
        if (input.promptIntegrity?.mode === "resolved-fragments") {
            try {
                verifyResolvedPromptBundleHash(templates, input.promptIntegrity);
            } catch {
                throw new Error("chat.prompt-fragment.resolved-prompt-hash-mismatch");
            }
        }
        const systemPrompt = withMcpToolPrefix(
            resolvedSystemPrompt,
            CHAT_SPEC.toolNames,
            CHAT_MCP_SERVER,
        );
        const result = await this.runner.run({
            label: CHAT_SPEC.name,
            idempotencyKey: input.idempotencyKey,
            prompt,
            systemPrompt,
            allowedTools: mcpToolNames(CHAT_MCP_SERVER, CHAT_SPEC.toolNames),
            model,
            maxTurns: CHAT_SPEC.limits.maxTurns,
            maxOutputTokens: CHAT_SPEC.limits.maxOutputTokens,
            maxBudgetUsd: CHAT_SPEC.limits.maxBudgetUsd,
            deadlineMs: input.deadlineMs,
            // 하위 프로세스의 활동도 수집되므로 사용자 태스크와 구분되도록 출처를 표시한다.
            env: {
                MONITOR_TASK_TITLE: `Agent · ${CHAT_SPEC.name}`,
                MONITOR_TASK_ORIGIN: "server-sdk",
                ...(input.apiKey !== undefined ? { ANTHROPIC_API_KEY: input.apiKey } : {}),
            },
            providerOptions: {
                mcpServers: {
                    [CHAT_MCP_SERVER]: buildMcpToolServer(
                        CHAT_MCP_SERVER,
                        CHAT_SPEC.tools,
                        handlers,
                        CHAT_SPEC.failures,
                    ),
                },
            },
            stream: runnerStream,
            ...(input.abortSignal !== undefined ? { parentSignal: input.abortSignal } : {}),
        });
        // 대화에 남기는 도구 호출은 승인 결과가 인용할 확인 대기 행뿐이고 나머지 궤적은 steps가 갖는다.
        const fragmentSnapshots = promptFragments.map(
            ({ content: _content, codeName: _codeName, backend: _backend, language: _language, ...snapshot }) =>
                snapshot,
        );
        const observation = {
            ...buildClaudeRunObservation(
                {
                    executionId: input.idempotencyKey,
                    attemptId: String(input.attempt),
                    agentName: CHAT_SPEC.name,
                    modelRequested: model,
                    promptVersion: CHAT_SPEC.promptVersion,
                    promptContentHash: `sha256:${resolvedPromptHash}`,
                    toolContractVersion: CHAT_SPEC.toolContractVersion,
                    modelCallId: `${input.idempotencyKey}:${input.attempt}:aggregate-model-call`,
                    repairAttempted: false,
                    validation: {
                        passed: result.errorSubtype === null,
                        errorCodes: result.errorSubtype === null ? [] : [result.errorSubtype],
                        citationPrecision: null,
                        citationRecall: null,
                    },
                },
                result,
            ),
            fragmentSnapshots,
            resolvedPromptHash,
            resolvedPromptHashes,
        };

        return {
            observation,
            text: selectFinalChatText(result.steps, result.rawOutput),
            backend: AGENT_BACKEND.claudeSdk,
            toolCalls: writes.proposals,
            modelUsed: result.actualModel ?? model,
            costUsd: result.costUsd,
            numTurns: result.numTurns,
            usage: result.usage,
            stopReason: chatStopReason(result),
            steps: result.steps.map(canonicalToolNames),
            errorSummary: result.errorSummary,
        };
    }

    private resolvePromptFragments(input: ChatTurnInput) {
        if (input.promptIntegrity?.mode === "legacy-full-prompt") {
            throw new Error("chat.prompt-fragment.legacy-integrity-rejected");
        }
        if (input.promptIntegrity?.mode === "fragment-content-only") {
            throw new Error("chat.prompt-fragment.content-only-integrity-rejected");
        }
        const fragments = input.promptIntegrity?.mode === "resolved-fragments"
            ? input.promptIntegrity.fragments
            : this.promptFragments.read();
        this.promptFragments.validate(fragments);
        return fragments;
    }
}

/** 실행 궤적에도 계약 이름을 남겨 두 구현체의 스텝을 같은 어휘로 비교한다. */
function canonicalToolNames(step: JobStepPayload): JobStepPayload {
    return {
        ...step,
        toolCalls: step.toolCalls.map((call) => ({ ...call, name: stripMcpToolPrefix(call.name) })),
        ...(step.toolName !== undefined ? { toolName: stripMcpToolPrefix(step.toolName) } : {}),
    };
}
