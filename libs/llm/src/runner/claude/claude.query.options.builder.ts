import type { HookInput, Options } from "@anthropic-ai/claude-agent-sdk";
import { providerBudgetBackstop } from "~llm/runner/landing.directive.js";
import type { AgentQueryRequest } from "~llm/runner/llm.runner.js";
import { buildAgentEnv } from "./claude.env.js";
import { resolveClaudeExecutablePath } from "./claude.executable.js";
import type { ClaudeQueryOptions } from "./claude.query.options.js";
import { buildQueryPermissions } from "./claude.query.permissions.js";
import { hardTurnCeiling } from "~llm/runner/landing.pacer.js";
import { buildSystemPrompt } from "./claude.system.prompt.js";
import type { ToolPacingDecision } from "./tool.pacing.hook.js";

export interface ClaudeQueryOptionsInput {
    readonly request: AgentQueryRequest<ClaudeQueryOptions>;
    readonly abortController: AbortController;
    readonly paceToolUse: (input: HookInput) => Promise<ToolPacingDecision>;
    readonly onStderr: (data: string) => void;
    /** 개발자의 CLI 설정과 디스크의 스킬을 실행 표면에 들일지이며 운영은 둘을 비운다. */
    readonly useLocalCliAuth: boolean;
}

/** 요청과 계약을 SDK 질의 옵션 하나로 조립하며 SDK 판이 바뀔 때만 바뀐다. */
export function buildClaudeQueryOptions(input: ClaudeQueryOptionsInput): Options {
    const { request, abortController, paceToolUse, onStderr, useLocalCliAuth } = input;
    const options = request.providerOptions;
    const executablePath = resolveClaudeExecutablePath();
    const permissions = buildQueryPermissions(request.allowedTools, request.disallowedTools);

    return {
        ...(executablePath !== undefined ? { pathToClaudeCodeExecutable: executablePath } : {}),
        abortController,
        ...(options?.cwd !== undefined ? { cwd: options.cwd } : {}),
        ...(options?.mcpServers !== undefined ? { mcpServers: options.mcpServers } : {}),
        model: request.model,
        // 자동 승인 목록은 권한 모드를 제약하지 않으므로 모드와 거절 목록이 함께 표면을 고정한다.
        allowedTools: [...permissions.allowedTools],
        disallowedTools: [...permissions.disallowedTools],
        tools: [...(options?.builtInTools ?? [])],
        maxTurns: hardTurnCeiling(request.maxTurns),
        systemPrompt: buildSystemPrompt(request, options),
        ...(request.outputSchema !== undefined
            ? { outputFormat: { type: "json_schema" as const, schema: request.outputSchema } }
            : {}),
        // 봉투가 정한 출력 한도를 CLI 는 질의 옵션이 아니라 이 환경변수로만 받는다.
        env: buildAgentEnv({
            ...request.env,
            IS_SANDBOX: "1",
            ...(request.maxOutputTokens !== undefined
                ? { CLAUDE_CODE_MAX_OUTPUT_TOKENS: String(request.maxOutputTokens) }
                : {}),
        }),
        permissionMode: permissions.permissionMode,
        strictMcpConfig: true,
        includePartialMessages: request.stream !== undefined,
        persistSession: false,
        // 운영에서는 컨테이너의 CLI 설정과 스킬이 실행 표면을 바꾸지 못하게 둘 다 비운다.
        settingSources: useLocalCliAuth ? ["user"] : [],
        skills: useLocalCliAuth ? "all" : [],
        ...(request.effort !== undefined ? { effort: request.effort } : {}),
        // 실행을 조이는 것은 종료이고 공급자 상한은 폭주만 끊는 백스톱이라 그보다 위에 둔다.
        ...(request.maxBudgetUsd !== undefined
            ? { maxBudgetUsd: providerBudgetBackstop(request.maxBudgetUsd) }
            : {}),
        ...(options?.fallbackModel !== undefined ? { fallbackModel: options.fallbackModel } : {}),
        stderr: onStderr,
        hooks: { PreToolUse: [{ hooks: [paceToolUse] }] },
    };
}
