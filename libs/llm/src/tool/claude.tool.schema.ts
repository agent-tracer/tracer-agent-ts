import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import type { ZodRawShape } from "zod";
import type { ToolHandlers } from "~llm/runner/llm.runner.js";
import { withMcpToolPrefix } from "./mcp.tool.prefix.js";
import { toolFailureText, unknownToolText, type ToolFailureTexts } from "./tool.failure.js";

/** 백엔드 어댑터가 각자의 방언으로 바꾸는 도구 계약의 구조적 표현이다. */
export interface LlmToolDefinition {
    readonly name: string;
    readonly description: string;
    readonly shape: ZodRawShape;
}

/** 도구 계약과 핸들러를 인프로세스 MCP 서버로 노출하며 설명이 가리키는 도구 이름도 정식 명칭으로 바꾼다. */
export function buildMcpToolServer(
    serverName: string,
    tools: readonly LlmToolDefinition[],
    handlers: ToolHandlers,
    failures: ToolFailureTexts,
): McpSdkServerConfigWithInstance {
    const names = tools.map((spec) => spec.name);
    return createSdkMcpServer({
        name: serverName,
        tools: tools.map((spec) =>
            tool(
                spec.name,
                withMcpToolPrefix(spec.description, names, serverName),
                spec.shape,
                async (args: Record<string, unknown>) => ({
                    content: [{ type: "text" as const, text: await invoke(handlers, spec.name, args, failures) }],
                }),
            ),
        ),
    });
}

async function invoke(
    handlers: ToolHandlers,
    name: string,
    args: Record<string, unknown>,
    failures: ToolFailureTexts,
): Promise<string> {
    const handler = handlers[name];
    if (handler === undefined) return unknownToolText(name, Object.keys(handlers));
    try {
        return await handler(args);
    } catch (err) {
        return toolFailureText(failures, name, err);
    }
}
