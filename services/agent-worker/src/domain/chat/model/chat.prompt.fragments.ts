import {
    computePromptFragmentHash,
    extractPromptFragmentPlaceholders,
    type PromptFragmentManifestEntry,
} from "@tracer-agent/llm";

export const CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY = "sdk.chat.assistant.system";

const TOOL_CONTRACT_VERSION = "1";
const OUTPUT_SCHEMA_VERSION = "1";

interface ChatPromptFragment {
    readonly codeName: `SDK_CHAT_${string}`;
    readonly definitionKey: `sdk.chat.${string}.en`;
    readonly fragmentSlot: string;
    readonly defaultVersion: "v1";
    readonly defaultContent: string;
    readonly contentHash: string;
    readonly placeholders: readonly string[];
}

function defineChatFragment(
    codeName: ChatPromptFragment["codeName"],
    definitionName: string,
    fragmentSlot: string,
    defaultContent: string,
): ChatPromptFragment {
    return {
        codeName,
        definitionKey: `sdk.chat.${definitionName}.en`,
        fragmentSlot,
        defaultVersion: "v1",
        defaultContent,
        contentHash: computePromptFragmentHash(defaultContent),
        placeholders: extractPromptFragmentPlaceholders(defaultContent),
    };
}

export const CHAT_TOOL_EXECUTION_SEMANTICS = defineChatFragment(
    "SDK_CHAT_TOOL_EXECUTION_SEMANTICS",
    "tool-execution-semantics",
    "toolExecutionSemantics",
    [
        "Read tools run immediately and are already scoped to this user. Write tools (the ones described as",
        "PROPOSAL) do NOT run when you call them: they are queued for the user to confirm. Propose one only",
        "when the user actually wants that change, tell them plainly that you are awaiting their confirmation",
        "and describe what will happen, and never state or imply that it has already been made.",
    ].join("\n"),
);

export const CHAT_GROUNDING_RULES = defineChatFragment(
    "SDK_CHAT_GROUNDING_RULES",
    "grounding-rules",
    "groundingRules",
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
    "SDK_CHAT_MEMORY_RULE",
    "memory-rule",
    "memoryRule",
    [
        "remember_fact is the one write tool that runs immediately rather than as a proposal, so say plainly",
        "that you have remembered something. Save only stable preferences or durable facts about how this user",
        "works, never one-off details of the current task.",
    ].join("\n"),
);

const CHAT_FRAGMENTS = [
    CHAT_TOOL_EXECUTION_SEMANTICS,
    CHAT_GROUNDING_RULES,
    CHAT_MEMORY_RULE,
] as const;

/** 조립 근원이 등록 경계에 건네는 대화 프롬프트 조각 manifest다. */
export const CHAT_PROMPT_FRAGMENT_MANIFEST: readonly PromptFragmentManifestEntry[] = CHAT_FRAGMENTS.map(
    (fragment) => ({
        backend: "claude-sdk",
        agentName: "chat",
        language: "en",
        codeName: fragment.codeName,
        definitionKey: fragment.definitionKey,
        fragmentName: fragment.fragmentSlot,
        defaultVersion: fragment.defaultVersion,
        defaultContent: fragment.defaultContent,
        toolContractVersion: TOOL_CONTRACT_VERSION,
        outputSchemaVersion: OUTPUT_SCHEMA_VERSION,
        bindings: [{ templateKey: CHAT_ASSISTANT_SYSTEM_TEMPLATE_KEY, fragmentSlot: fragment.fragmentSlot }],
    }),
);
