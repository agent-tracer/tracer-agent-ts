import {
    definePromptFragment,
    type PromptFragmentBindingSpec,
} from "~agent-worker/support/prompt.fragment.js";
import { CLEANUP_FRAGMENT_DEFAULTS } from "./cleanup.prompt.fragment.defaults.js";

function cleanupFragment(
    codeName: `SDK_${string}`,
    slot: keyof typeof CLEANUP_FRAGMENT_DEFAULTS,
    key: string,
) {
    return definePromptFragment({
        codeName,
        definitionKey: `sdk.task-cleanup.${key}.en`,
        defaultVersion: "v1",
        defaultContent: CLEANUP_FRAGMENT_DEFAULTS[slot].join("\n"),
    });
}

export const CLEANUP_REVIEW_GUARANTEE = cleanupFragment(
    "SDK_CLEANUP_REVIEW_GUARANTEE",
    "reviewGuarantee",
    "review-guarantee",
);
export const CLEANUP_REVIEWER_SOURCING = cleanupFragment(
    "SDK_CLEANUP_REVIEWER_SOURCING",
    "reviewerSourcing",
    "reviewer-sourcing",
);
export const CLEANUP_EVIDENCE_DISCIPLINE = cleanupFragment(
    "SDK_CLEANUP_EVIDENCE_DISCIPLINE",
    "evidenceDiscipline",
    "evidence-discipline",
);
export const CLEANUP_SUGGESTION_RULES = cleanupFragment(
    "SDK_CLEANUP_SUGGESTION_RULES",
    "suggestionRules",
    "suggestion-rules",
);
export const CLEANUP_REDISPATCH_PROTOCOL = cleanupFragment(
    "SDK_CLEANUP_REDISPATCH_PROTOCOL",
    "redispatchProtocol",
    "redispatch-protocol",
);
export const CLEANUP_REPAIR_DIRECTIVE = cleanupFragment(
    "SDK_CLEANUP_REPAIR_DIRECTIVE",
    "repairDirective",
    "repair-directive",
);
export const CLEANUP_CANDIDATE_FIELDS = cleanupFragment(
    "SDK_CLEANUP_CANDIDATE_FIELDS",
    "candidateFields",
    "candidate-fields",
);
export const CLEANUP_TRIAGE_POLICY = cleanupFragment(
    "SDK_CLEANUP_TRIAGE_POLICY",
    "triagePolicy",
    "triage-policy",
);
export const CLEANUP_INSPECT_WEIGHTING = cleanupFragment(
    "SDK_CLEANUP_INSPECT_WEIGHTING",
    "inspectWeighting",
    "inspect-weighting",
);
export const CLEANUP_REVIEWER_CHARTER = cleanupFragment(
    "SDK_CLEANUP_REVIEWER_CHARTER",
    "reviewerCharter",
    "reviewer-charter",
);

export const CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY = "sdk.task-cleanup.investigator.system" as const;
export const CLEANUP_TRIAGE_SYSTEM_TEMPLATE_KEY = "sdk.task-cleanup.triage.system" as const;
export const CLEANUP_INSPECT_SYSTEM_TEMPLATE_KEY = "sdk.task-cleanup.inspect.system" as const;
export const CLEANUP_INVESTIGATOR_REPAIR_TEMPLATE_KEY = "sdk.task-cleanup.investigator.repair" as const;

export const CLEANUP_PROMPT_FRAGMENT_BINDINGS: readonly PromptFragmentBindingSpec[] = [
    {
        templateKey: CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "reviewGuarantee",
        fragment: CLEANUP_REVIEW_GUARANTEE,
    },
    {
        templateKey: CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "reviewerSourcing",
        fragment: CLEANUP_REVIEWER_SOURCING,
    },
    {
        templateKey: CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "evidenceDiscipline",
        fragment: CLEANUP_EVIDENCE_DISCIPLINE,
    },
    {
        templateKey: CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "suggestionRules",
        fragment: CLEANUP_SUGGESTION_RULES,
    },
    {
        templateKey: CLEANUP_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "redispatchProtocol",
        fragment: CLEANUP_REDISPATCH_PROTOCOL,
    },
    {
        templateKey: CLEANUP_INVESTIGATOR_REPAIR_TEMPLATE_KEY,
        fragmentSlot: "repairDirective",
        fragment: CLEANUP_REPAIR_DIRECTIVE,
    },
    {
        templateKey: CLEANUP_TRIAGE_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "candidateFields",
        fragment: CLEANUP_CANDIDATE_FIELDS,
    },
    {
        templateKey: CLEANUP_TRIAGE_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "triagePolicy",
        fragment: CLEANUP_TRIAGE_POLICY,
    },
    {
        templateKey: CLEANUP_TRIAGE_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "inspectWeighting",
        fragment: CLEANUP_INSPECT_WEIGHTING,
    },
    {
        templateKey: CLEANUP_INSPECT_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "reviewerCharter",
        fragment: CLEANUP_REVIEWER_CHARTER,
    },
];
