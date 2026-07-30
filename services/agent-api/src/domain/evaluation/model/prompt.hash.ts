import { computePromptFragmentHash } from "@tracer-agent/llm";

/** 프롬프트 본문 해시는 계약의 prompt fragment integrity 규칙이 정하며 요청이 다른 값을 실었으면 거절한다. */
export function resolvePromptContentHash(content: string, claimed?: string): string {
    const computed = computePromptFragmentHash(content);
    if (claimed !== undefined && claimed !== computed) throw new Error("Prompt content hash mismatch");
    return computed;
}
