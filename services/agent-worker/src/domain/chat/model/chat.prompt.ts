import type { AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { SAFETY_POLICY } from "~agent-worker/support/safety.policy.js";
import { CHAT_MESSAGE_ROLE } from "./chat.const.js";
import type { ChatTurnMessage, ChatUserFact } from "./chat.turn.model.js";

export const CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY = "chat.assistant.system";

// 프롬프트 캐시는 접두사 일치라 시스템 프롬프트에 요청마다 바뀌는 값이 섞이면 매 요청 무효화된다.
export function buildChatSystemPrompt(prompt: AgentPrompt, language: string): string {
    const slot = (name: string): string => prompt.slot(CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY, name);
    return [
        SAFETY_POLICY,
        "",
        "You are the assistant of Agent Tracer, an observability tool that records coding-agent sessions",
        "(tasks), their timelines, verification rules, memos, recipes, tags, cleanup suggestions, and AI jobs.",
        "",
        "Your job is to work out what the user is actually asking for, reach for the tools that answer it,",
        "ground your reply in what they return, and propose the changes their work needs.",
        slot("toolExecutionSemantics"),
        "",
        "How to work:",
        slot("groundingRules"),
        "",
        "Memory:",
        slot("memoryRule"),
        "",
        `Output language: ${prompt.languageDirective(language)}`,
    ].join("\n");
}

/** 러너가 단발이라 대화 전체를 한 프롬프트로 재생하며 마지막 사용자 메시지가 이번 턴의 질문이다. */
export function renderChatPrompt(
    messages: readonly ChatTurnMessage[],
    summary?: string | null,
    facts?: readonly ChatUserFact[],
): string {
    const lines: string[] = [];
    if (facts !== undefined && facts.length > 0) {
        lines.push('<memory source="untrusted">');
        for (const fact of facts) lines.push(`- ${fact.key}: ${fact.content}`);
        lines.push("</memory>", "");
    }
    if (summary !== undefined && summary !== null && summary.trim().length > 0) {
        lines.push('<summary source="untrusted">', summary.trim(), "</summary>", "");
    }
    lines.push('<history source="untrusted">');
    for (const message of messages) lines.push(renderMessage(message));
    lines.push("</history>", "", "Answer the user's most recent message.");
    return lines.join("\n");
}

function renderMessage(message: ChatTurnMessage): string {
    if (message.role === CHAT_MESSAGE_ROLE.user) return `User: ${message.content}`;
    if (message.role === CHAT_MESSAGE_ROLE.tool) return `<tool_result>${message.content}</tool_result>`;
    const calls = message.toolCalls ?? [];
    const suffix = calls.length > 0 ? ` (called ${calls.map((call) => call.name).join(", ")})` : "";
    return `Assistant: ${message.content}${suffix}`;
}

export const CHAT_SUMMARY_SYSTEM_PROMPT =
    "You compress an older slice of a running conversation into a durable summary. "
    + "Preserve decisions made, entities and identifiers mentioned (task ids, rule ids, memo ids, recipe ids, and similar), "
    + "and open threads or questions still unresolved. Do not restate instructions or add pleasantries. "
    + "Write plain prose, no headings or bullet lists. Keep the summary to 300 words or fewer.";

/** 요약 러너가 도구 없이 받는 단발 프롬프트이며 앞선 요약이 있으면 이어 붙여 누적 압축한다. */
export function renderChatSummaryPrompt(
    olderMessages: readonly ChatTurnMessage[],
    existingSummary?: string | null,
): string {
    const lines: string[] = [];
    if (existingSummary !== undefined && existingSummary !== null && existingSummary.trim().length > 0) {
        lines.push("Existing summary of the conversation so far:", existingSummary.trim(), "");
    }
    lines.push("Additional messages to fold into the summary, oldest first:");
    for (const message of olderMessages) lines.push(renderMessage(message));
    lines.push("", "Write the updated summary now.");
    return lines.join("\n");
}

export const CHAT_TITLE_SYSTEM_PROMPT =
    "Write a short 2-6 word title for this conversation in the user's language; no quotes.";

/** 제목 러너도 요약처럼 도구 없는 단발 호출이라 지금까지의 대화를 그대로 재생한다. */
export function renderChatTitlePrompt(messages: readonly ChatTurnMessage[]): string {
    const lines: string[] = ["Conversation:"];
    for (const message of messages) lines.push(renderMessage(message));
    lines.push("", "Title:");
    return lines.join("\n");
}
