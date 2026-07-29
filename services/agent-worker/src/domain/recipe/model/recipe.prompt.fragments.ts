import {
    definePromptFragment,
    type PromptFragmentBindingSpec,
} from "~agent-worker/support/prompt.fragment.js";
import { RECIPE_FRAGMENT_DEFAULTS } from "./recipe.prompt.fragment.defaults.js";

function recipeFragment(
    codeName: `SDK_${string}`,
    slot: keyof typeof RECIPE_FRAGMENT_DEFAULTS,
    key: string,
) {
    return definePromptFragment({
        codeName,
        definitionKey: `sdk.recipe-scan.${key}.en`,
        defaultVersion: "v1",
        defaultContent: RECIPE_FRAGMENT_DEFAULTS[slot].join("\n"),
    });
}

export const RECIPE_DEFINITION = recipeFragment(
    "SDK_RECIPE_DEFINITION",
    "recipeDefinition",
    "recipe-definition",
);
export const RECIPE_EVIDENCE_SOURCING = recipeFragment(
    "SDK_RECIPE_EVIDENCE_SOURCING",
    "evidenceSourcing",
    "evidence-sourcing",
);
export const RECIPE_CITATION_DISCIPLINE = recipeFragment(
    "SDK_RECIPE_CITATION_DISCIPLINE",
    "citationDiscipline",
    "citation-discipline",
);
export const RECIPE_TURN_SPLITTING = recipeFragment(
    "SDK_RECIPE_TURN_SPLITTING",
    "turnSplitting",
    "turn-splitting",
);
export const RECIPE_CANDIDATE_BUDGET = recipeFragment(
    "SDK_RECIPE_CANDIDATE_BUDGET",
    "candidateBudget",
    "candidate-budget",
);
export const RECIPE_REDISPATCH_PROTOCOL = recipeFragment(
    "SDK_RECIPE_REDISPATCH_PROTOCOL",
    "redispatchProtocol",
    "redispatch-protocol",
);
export const RECIPE_OUTPUT_FIELDS = recipeFragment(
    "SDK_RECIPE_OUTPUT_FIELDS",
    "outputFields",
    "output-fields",
);
export const RECIPE_QUALITY_RULES = recipeFragment(
    "SDK_RECIPE_QUALITY_RULES",
    "qualityRules",
    "quality-rules",
);
export const RECIPE_REPAIR_DIRECTIVE = recipeFragment(
    "SDK_RECIPE_REPAIR_DIRECTIVE",
    "repairDirective",
    "repair-directive",
);
export const RECIPE_SPECIALIST_CATALOG = recipeFragment(
    "SDK_RECIPE_SPECIALIST_CATALOG",
    "specialistCatalog",
    "specialist-catalog",
);
export const RECIPE_DISPATCH_WEIGHTING = recipeFragment(
    "SDK_RECIPE_DISPATCH_WEIGHTING",
    "dispatchWeighting",
    "dispatch-weighting",
);
export const RECIPE_EMPTY_PLAN = recipeFragment("SDK_RECIPE_EMPTY_PLAN", "emptyPlan", "empty-plan");
export const RECIPE_SPECIALIST_CHARTER = recipeFragment(
    "SDK_RECIPE_SPECIALIST_CHARTER",
    "specialistCharter",
    "specialist-charter",
);
export const RECIPE_SPECIALIST_REPORTING = recipeFragment(
    "SDK_RECIPE_SPECIALIST_REPORTING",
    "specialistReporting",
    "specialist-reporting",
);

export const RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY = "sdk.recipe-scan.investigator.system" as const;
export const RECIPE_SURVEY_SYSTEM_TEMPLATE_KEY = "sdk.recipe-scan.survey.system" as const;
export const RECIPE_PROBE_SYSTEM_TEMPLATE_KEY = "sdk.recipe-scan.probe.system" as const;
export const RECIPE_INVESTIGATOR_REPAIR_TEMPLATE_KEY = "sdk.recipe-scan.investigator.repair" as const;

export const RECIPE_PROMPT_FRAGMENT_BINDINGS: readonly PromptFragmentBindingSpec[] = [
    {
        templateKey: RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "recipeDefinition",
        fragment: RECIPE_DEFINITION,
    },
    {
        templateKey: RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "evidenceSourcing",
        fragment: RECIPE_EVIDENCE_SOURCING,
    },
    {
        templateKey: RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "citationDiscipline",
        fragment: RECIPE_CITATION_DISCIPLINE,
    },
    {
        templateKey: RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "turnSplitting",
        fragment: RECIPE_TURN_SPLITTING,
    },
    {
        templateKey: RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "candidateBudget",
        fragment: RECIPE_CANDIDATE_BUDGET,
    },
    {
        templateKey: RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "redispatchProtocol",
        fragment: RECIPE_REDISPATCH_PROTOCOL,
    },
    {
        templateKey: RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "outputFields",
        fragment: RECIPE_OUTPUT_FIELDS,
    },
    {
        templateKey: RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "qualityRules",
        fragment: RECIPE_QUALITY_RULES,
    },
    {
        templateKey: RECIPE_INVESTIGATOR_REPAIR_TEMPLATE_KEY,
        fragmentSlot: "repairDirective",
        fragment: RECIPE_REPAIR_DIRECTIVE,
    },
    {
        templateKey: RECIPE_SURVEY_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "specialistCatalog",
        fragment: RECIPE_SPECIALIST_CATALOG,
    },
    {
        templateKey: RECIPE_SURVEY_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "dispatchWeighting",
        fragment: RECIPE_DISPATCH_WEIGHTING,
    },
    {
        templateKey: RECIPE_SURVEY_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "emptyPlan",
        fragment: RECIPE_EMPTY_PLAN,
    },
    {
        templateKey: RECIPE_PROBE_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "specialistCharter",
        fragment: RECIPE_SPECIALIST_CHARTER,
    },
    {
        templateKey: RECIPE_PROBE_SYSTEM_TEMPLATE_KEY,
        fragmentSlot: "specialistReporting",
        fragment: RECIPE_SPECIALIST_REPORTING,
    },
];
