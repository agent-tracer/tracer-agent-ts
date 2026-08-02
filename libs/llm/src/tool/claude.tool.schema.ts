import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import type { ZodRawShape } from "zod";
import type { ToolHandler, ToolHandlers } from "~llm/runner/llm.runner.js";
import { redactSerialized } from "~llm/support/redaction.js";
import { withMcpToolPrefix } from "./mcp.tool.prefix.js";
import { toolFailureText, unknownToolText, type ToolFailureTexts } from "./tool.failure.js";

/** 백엔드 어댑터가 각자의 방언으로 바꾸는 도구 계약의 구조적 표현이다. */
export interface LlmToolDefinition {
    readonly name: string;
    readonly description: string;
    readonly shape: ZodRawShape;
}

/** 도구 계약과 핸들러를 인프로세스 MCP 서버로 노출하며 설명이 가리키는 도구 이름도 정식 명칭으로 바꾼다. */
export function buildMcpToolServer<Name extends string>(
    serverName: string,
    tools: readonly LlmToolDefinition[],
    handlers: ToolHandlers<Name>,
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
                    content: [
                        { type: "text" as const, text: await callToolForModel(handlers, spec.name, args, failures) },
                    ],
                }),
            ),
        ),
    });
}

/** 도구 하나를 실행하고 그 결과가 모델의 다음 입력이 되기 전에 계약의 query 자리를 지난다. */
export async function callToolForModel<Name extends string>(
    handlers: ToolHandlers<Name>,
    name: string,
    args: Record<string, unknown>,
    failures: ToolFailureTexts,
): Promise<string> {
    const handler = (handlers as Readonly<Record<string, ToolHandler | undefined>>)[name];
    if (handler === undefined) return unknownToolText(name, Object.keys(handlers));
    try {
        return redactSerialized(await handler(args));
    } catch (err) {
        return redactSerialized(toolFailureText(failures, name, err));
    }
}
