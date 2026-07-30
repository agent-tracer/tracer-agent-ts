import {
    definePromptFragment,
    type PromptFragmentBindingSpec,
} from "~agent-worker/support/prompt.fragment.js";
import { RECIPE_FRAGMENT_DEFAULTS } from "./recipe.prompt.fragment.defaults.js";

function recipeFragment(slot: keyof typeof RECIPE_FRAGMENT_DEFAULTS, fragmentKey: string) {
    return definePromptFragment({
        agentName: "recipe-scan",
        fragmentKey,
        defaultVersion: "v1",
        defaultContent: RECIPE_FRAGMENT_DEFAULTS[slot].join("\n"),
    });
}

export const RECIPE_DEFINITION = recipeFragment("recipeDefinition", "recipe-definition");
export const RECIPE_EVIDENCE_SOURCING = recipeFragment("evidenceSourcing", "evidence-sourcing");
export const RECIPE_CITATION_DISCIPLINE = recipeFragment("citationDiscipline", "citation-discipline");
export const RECIPE_TURN_SPLITTING = recipeFragment("turnSplitting", "turn-splitting");
export const RECIPE_CANDIDATE_BUDGET = recipeFragment("candidateBudget", "candidate-budget");
export const RECIPE_REDISPATCH_PROTOCOL = recipeFragment("redispatchProtocol", "redispatch-protocol");
export const RECIPE_OUTPUT_FIELDS = recipeFragment("outputFields", "output-fields");
export const RECIPE_QUALITY_RULES = recipeFragment("qualityRules", "quality-rules");
export const RECIPE_REPAIR_DIRECTIVE = recipeFragment("repairDirective", "repair-directive");
export const RECIPE_SPECIALIST_CATALOG = recipeFragment("specialistCatalog", "specialist-catalog");
export const RECIPE_DISPATCH_WEIGHTING = recipeFragment("dispatchWeighting", "dispatch-weighting");
export const RECIPE_EMPTY_PLAN = recipeFragment("emptyPlan", "empty-plan");
export const RECIPE_SPECIALIST_CHARTER = recipeFragment("specialistCharter", "specialist-charter");
export const RECIPE_SPECIALIST_REPORTING = recipeFragment("specialistReporting", "specialist-reporting");

export const RECIPE_INVESTIGATOR_SYSTEM_TEMPLATE_KEY = "recipe-scan.investigator.system" as const;
export const RECIPE_SURVEY_SYSTEM_TEMPLATE_KEY = "recipe-scan.survey.system" as const;
export const RECIPE_PROBE_SYSTEM_TEMPLATE_KEY = "recipe-scan.probe.system" as const;
export const RECIPE_INVESTIGATOR_REPAIR_TEMPLATE_KEY = "recipe-scan.investigator.repair" as const;

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
