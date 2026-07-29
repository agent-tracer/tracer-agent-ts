export interface ChatResponseStep {
    readonly role: string;
    readonly content: string;
    readonly toolCalls: readonly unknown[];
}

export function selectFinalChatText(steps: readonly ChatResponseStep[], fallback: string): string {
    const final = [...steps]
        .reverse()
        .find(
            (step) =>
                step.role === "assistant" && step.toolCalls.length === 0 && step.content.trim().length > 0,
        );
    return final?.content ?? fallback;
}
