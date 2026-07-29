import type { ClaudeQueryOptions, IQueryRunner } from "@tracer-agent/llm";
import { CHAT_SUMMARY_SPEC } from "~agent-worker/domain/chat/model/chat.summary.spec.js";
import type {
    ChatSummarizeRequest,
    ChatSummarizerPort,
} from "~agent-worker/domain/chat/port/chat.summarizer.port.js";

const LABEL = "chat-summary";

/** 대화 러너와 같은 실행기를 도구 없이 재사용하는 단발 요약 실행이다. */
export class ChatSummarizerAdapter implements ChatSummarizerPort {
    constructor(private readonly runner: IQueryRunner<ClaudeQueryOptions>) {}

    requiresLocalApiKey(): boolean {
        return this.runner.requiresLocalApiKey();
    }

    async summarize(request: ChatSummarizeRequest): Promise<string> {
        const result = await this.runner.run({
            label: LABEL,
            prompt: request.prompt,
            systemPrompt: request.systemPrompt,
            allowedTools: [],
            model: CHAT_SUMMARY_SPEC.limits.model,
            maxTurns: 1,
            maxOutputTokens: CHAT_SUMMARY_SPEC.limits.maxOutputTokens,
            deadlineMs: CHAT_SUMMARY_SPEC.limits.deadlineMs,
            // 하위 프로세스의 활동도 수집되므로 사용자 태스크와 구분되도록 출처를 표시한다.
            env: {
                MONITOR_TASK_TITLE: `Agent · ${LABEL}`,
                MONITOR_TASK_ORIGIN: "server-sdk",
                ...(request.apiKey !== undefined ? { ANTHROPIC_API_KEY: request.apiKey } : {}),
            },
        });
        if (result.errorSummary !== null) throw new Error(result.errorSummary);
        return result.rawOutput;
    }
}
