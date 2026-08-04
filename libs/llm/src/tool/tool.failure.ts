/** 도구가 실패했을 때 모델이 읽는 문구이며 값은 각 에이전트의 계약이 소유한다. */
export interface ToolFailureTexts {
    /** {tool}과 {reason} 자리를 갖는다. */
    readonly toolFailed: string;
}

/** 계약 문구는 언어 중립 JSON이라 자리를 값으로 채우는 일은 읽는 쪽이 한다. */
export function renderFailureText(template: string, values: Readonly<Record<string, string>>): string {
    return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

/** 도구 실패를 모델이 다음 행동을 정할 수 있는 문장으로 바꾼다. */
export function toolFailureText(texts: ToolFailureTexts, name: string, err: unknown): string {
    const reason = err instanceof Error ? err.message : String(err);
    return renderFailureText(texts.toolFailed, { tool: name, reason });
}

export function unknownToolText(name: string, available: readonly string[]): string {
    return `Tool ${name} is not available. Available tools: ${available.join(", ")}.`;
}
