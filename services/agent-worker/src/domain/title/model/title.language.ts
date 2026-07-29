import { readContractJson } from "~agent-worker/support/contract.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";

interface LanguageDirectiveContract {
    readonly languages: readonly OutputLanguage[];
    readonly agents: Readonly<Record<string, Readonly<Record<OutputLanguage, string>>>>;
}

const DIRECTIVES = readContractJson<LanguageDirectiveContract>("agent/shared/language.directives.json");

/** 에이전트와 언어에 맞는 출력 언어 지시문이며 값은 계약이 소유한다. */
export function languageDirective(agentId: string, language: OutputLanguage): string {
    const agent = DIRECTIVES.agents[agentId];
    if (agent === undefined) throw new Error(`no language directives for agent ${agentId}`);
    return agent[language];
}

/** 계약이 이 에이전트에 대해 지시문을 갖는 언어 전부다. */
export function directiveLanguages(agentId: string): readonly OutputLanguage[] {
    const agent = DIRECTIVES.agents[agentId];
    if (agent === undefined) throw new Error(`no language directives for agent ${agentId}`);
    return Object.keys(agent) as OutputLanguage[];
}
