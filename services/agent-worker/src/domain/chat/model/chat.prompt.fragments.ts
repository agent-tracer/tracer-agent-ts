import type { PromptFragmentManifestEntry } from "@tracer-agent/llm";
import {
    buildPromptFragmentManifest, definePromptFragment, type PromptFragmentBindingSpec,
} from "~agent-worker/support/prompt.fragment.js";

export const CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY = "chat.assistant.system";

function defineChatFragment(fragmentKey: string, defaultContent: string) {
    return definePromptFragment({
        agentName: "chat",
        fragmentKey,
        defaultVersion: "v1",
        defaultContent,
    });
}

export const CHAT_TOOL_EXECUTION_SEMANTICS = defineChatFragment(
    "tool-execution-semantics",
    [
        "Read tools run immediately and are already scoped to this user. Write tools (the ones described as",
        "PROPOSAL) do NOT run when you call them: they are queued for the user to confirm. Propose one only",
        "when the user actually wants that change, tell them plainly that you are awaiting their confirmation",
        "and describe what will happen, and never state or imply that it has already been made.",
    ].join("\n"),
);

export const CHAT_GROUNDING_RULES = defineChatFragment(
    "grounding-rules",
    [
        "- Ground every factual claim in what a tool returned. Never invent task ids, rule ids, event",
        "  contents, or numbers.",
        "- Find first, then drill in: locate what the user means with a search or a listing, then pull the",
        "  detail of the one item you found.",
        "- Stop calling tools the moment you can answer. Go wider or deeper only while the answer is still",
        "  missing something.",
        "- If the tools return nothing relevant, say so plainly instead of guessing.",
        "- Be concise. Cite the concrete task titles, ids, or timestamps you saw when they help the user act.",
    ].join("\n"),
);

export const CHAT_MEMORY_RULE = defineChatFragment(
    "memory-rule",
    [
        "remember_fact is the one write tool that runs immediately rather than as a proposal, so say plainly",
        "that you have remembered something. Save only stable preferences or durable facts about how this user",
        "works, never one-off details of the current task.",
    ].join("\n"),
);

const CHAT_PROMPT_FRAGMENT_BINDINGS: readonly PromptFragmentBindingSpec[] = [
    {
        templateKey: CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "toolExecutionSemantics",
        fragment: CHAT_TOOL_EXECUTION_SEMANTICS,
    },
    {
        templateKey: CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "groundingRules",
        fragment: CHAT_GROUNDING_RULES,
    },
    {
        templateKey: CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "memoryRule",
        fragment: CHAT_MEMORY_RULE,
    },
];

/** 조립 근원이 등록 경계에 건네는 대화 프롬프트 조각 manifest다. */
export const CHAT_PROMPT_FRAGMENT_MANIFEST: readonly PromptFragmentManifestEntry[] =
    buildPromptFragmentManifest("chat", CHAT_PROMPT_FRAGMENT_BINDINGS);
