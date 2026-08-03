import type { SDKPartialAssistantMessage } from "@anthropic-ai/claude-agent-sdk";

/** 부분 어시스턴트 메시지가 실어 전달하는 원본 스트림 이벤트다. */
export type PartialAssistantStreamEvent = SDKPartialAssistantMessage["event"];

/** 부분 어시스턴트 스트림 이벤트에서 텍스트 조각만 뽑아내며 텍스트 델타가 아니면 빈 문자열이다. */
export function partialAssistantDeltaText(event: PartialAssistantStreamEvent): string {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        return event.delta.text;
    }
    return "";
}
