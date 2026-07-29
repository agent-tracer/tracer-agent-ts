import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { mcpToolName } from "./mcp.tool.prefix.js";

export interface ClaudeSubagentSpec<ToolName extends string> {
    readonly description: string;
    readonly prompt: string;
    readonly tools: readonly ToolName[];
    readonly maxTurns: number;
}

/** 역할별 서브에이전트 계약을 Claude Agent SDK 정의로 렌더링한다. */
export class ClaudeSubagentCatalog<Role extends string, ToolName extends string> {
    constructor(
        private readonly specs: Readonly<Record<Role, ClaudeSubagentSpec<ToolName>>>,
        private readonly mcpServer: string,
    ) {}

    definitions(model: string): Readonly<Record<Role, AgentDefinition>> {
        return Object.fromEntries(
            Object.entries<ClaudeSubagentSpec<ToolName>>(this.specs).map(([role, spec]) => [
                role,
                {
                    description: spec.description,
                    prompt: spec.prompt,
                    tools: spec.tools.map((tool) => mcpToolName(this.mcpServer, tool)),
                    model,
                    maxTurns: spec.maxTurns,
                    permissionMode: "bypassPermissions" as const,
                },
            ]),
        ) as Record<Role, AgentDefinition>;
    }
}
