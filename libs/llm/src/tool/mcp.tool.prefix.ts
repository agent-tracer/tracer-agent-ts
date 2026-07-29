/** Claude Agent SDK가 MCP 도구에 강제하는 정식 명칭을 프롬프트 텍스트에 반영한다. */
export function withMcpToolPrefix(
    canonicalPrompt: string,
    toolNames: readonly string[],
    serverName: string,
): string {
    let prompt = canonicalPrompt;
    for (const name of toolNames) {
        prompt = prompt.replace(new RegExp(`\\b${escapeRegExp(name)}\\b`, "g"), `mcp__${serverName}__${name}`);
    }
    return prompt;
}

export function mcpToolNames(serverName: string, toolNames: readonly string[]): readonly string[] {
    return toolNames.map((name) => mcpToolName(serverName, name));
}

export function mcpToolName(serverName: string, toolName: string): string {
    return `mcp__${serverName}__${toolName}`;
}

/** SDK가 붙인 서버 접두사를 벗겨 두 실행 백엔드가 같은 도구 이름을 기록하게 한다. */
export function stripMcpToolPrefix(name: string): string {
    return /^mcp__.+?__(.+)$/.exec(name)?.[1] ?? name;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
