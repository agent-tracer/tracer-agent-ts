import {
    definePromptFragment,
    type PromptFragmentBindingSpec,
} from "~agent-worker/support/prompt.fragment.js";

export const TITLE_CONTEXT_SHAPE = definePromptFragment({
    agentName: "title-suggestion",
    fragmentKey: "context-shape",
    defaultVersion: "v1",
    defaultContent: [
        "The user message carries the task's current title and an excerpt of its conversation turns (what the",
        "user asked, what the agent reported back): the oldest user turn plus the most recent turns. Turns in",
        "the middle are dropped when the task is long, and the excerpt says so when that happened.",
    ].join("\n"),
});

export const TITLE_SPEC_FRAGMENT = definePromptFragment({
    agentName: "title-suggestion",
    fragmentKey: "title-spec",
    defaultVersion: "v1",
    defaultContent: [
        "Each title must be concrete — naming the area or action — under 80 characters, and normally 4-9 words",
        'in languages where words are space-delimited. Prefer an imperative or noun phrase, as in "Fix auth',
        'middleware token leak" or "Migrate billing schema to v2". Never use a placeholder such as "Task 123",',
        '"Untitled", or "Test".',
    ].join("\n"),
});

export const TITLE_ANSWER_SHAPE = definePromptFragment({
    agentName: "title-suggestion",
    fragmentKey: "answer-shape",
    defaultVersion: "v1",
    defaultContent: [
        "If the current title is already concrete, accurate, and readable, return an empty list: that is a",
        "real answer, not a failure. Otherwise return exactly 2-3 distinct alternatives. Do not repeat the",
        "current title or another suggestion. Each rationale is one evidence-grounded sentence under 200",
        "characters explaining what drove the suggestion. Do not invent work the evidence does not show.",
    ].join("\n"),
});

export const TITLE_REPAIR_DIRECTIVE = definePromptFragment({
    agentName: "title-suggestion",
    fragmentKey: "repair-directive",
    defaultVersion: "v1",
    defaultContent: [
        "Change only what is necessary to satisfy these errors. Return either an empty suggestions list or 2-3",
        "distinct alternatives. Do not repeat the current title, use placeholder titles, or invent work the",
        "evidence does not show. Then return the complete repaired suggestion list.",
    ].join("\n"),
});

export const TITLE_SYSTEM_TEMPLATE_KEY = "title-suggestion.investigator.system" as const;

export const TITLE_REPAIR_TEMPLATE_KEY = "title-suggestion.investigator.repair" as const;

export const TITLE_PROMPT_FRAGMENT_BINDINGS: readonly PromptFragmentBindingSpec[] = [
    {
        templateKey: TITLE_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "contextShape",
        fragment: TITLE_CONTEXT_SHAPE,
    },
    { templateKey: TITLE_SYSTEM_TEMPLATE_KEY, fragmentSlot: "titleSpec", fragment: TITLE_SPEC_FRAGMENT },
    {
        templateKey: TITLE_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "answerShape",
        fragment: TITLE_ANSWER_SHAPE,
    },
    {
        templateKey: TITLE_REPAIR_TEMPLATE_KEY,
        fragmentSlot: "repairDirective",
        fragment: TITLE_REPAIR_DIRECTIVE,
    },
];
