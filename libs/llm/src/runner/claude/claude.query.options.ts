import type { McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";

/** Claude Agent SDK에서만 쓰는 질의 옵션이다. */
export interface ClaudeQueryOptions {
    readonly useClaudeCodePreset?: boolean;
    readonly excludeDynamicSections?: boolean;
    readonly cwd?: string;
    readonly mcpServers?: Record<string, McpSdkServerConfigWithInstance>;
    readonly fallbackModel?: string;
    /** 부모 대화에서 노출할 Claude Code 빌트인 도구다. */
    readonly builtInTools?: readonly string[];
}
