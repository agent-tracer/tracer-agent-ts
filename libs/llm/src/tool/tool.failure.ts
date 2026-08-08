/** 도구가 실패했을 때 모델이 읽는 문구이며 값은 각 에이전트의 계약이 소유한다. */
export interface ToolFailureTexts {
    /** {tool}과 {reason} 자리를 갖는다. */
    readonly toolFailed: string;
    /** {tool}과 {action}과 {missing} 자리를 갖는다. */
    readonly argumentsMissing?: string;
}

/** 빠진 인자를 채우면 같은 호출이 성립하므로 포기가 아니라 고쳐 다시 부르라고 말해야 하는 실패다. */
export class ToolArgumentsMissingError extends Error {
    constructor(
        readonly action: string,
        readonly missing: readonly string[],
    ) {
        super(`arguments ${missing.join(", ")} are required for action ${action}`);
        this.name = "ToolArgumentsMissingError";
    }
}

/** 계약 문구는 언어 중립 JSON이라 자리를 값으로 채우는 일은 읽는 쪽이 한다. */
export function renderFailureText(template: string, values: Readonly<Record<string, string>>): string {
    return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

/** 도구 실패를 모델이 다음 행동을 정할 수 있는 문장으로 바꾼다. */
export function toolFailureText(texts: ToolFailureTexts, name: string, err: unknown): string {
    if (err instanceof ToolArgumentsMissingError && texts.argumentsMissing !== undefined) {
        return renderFailureText(texts.argumentsMissing, {
            tool: name,
            action: err.action,
            missing: err.missing.join(", "),
        });
    }
    const reason = err instanceof Error ? err.message : String(err);
    return renderFailureText(texts.toolFailed, { tool: name, reason });
}

export function unknownToolText(name: string, available: readonly string[]): string {
    return `Tool ${name} is not available. Available tools: ${available.join(", ")}.`;
}
