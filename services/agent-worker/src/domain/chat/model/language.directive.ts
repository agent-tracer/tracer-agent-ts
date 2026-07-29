import { readContractJson } from "~agent-worker/support/contract.js";

/** 출력 언어 코드이며 auto는 입력에서 지배적인 언어를 따르라는 뜻이다. */
export type PromptLanguage = "auto" | "ko" | "en" | "ja" | "zh";

interface LanguageDirectiveContract {
    readonly languages: readonly PromptLanguage[];
    readonly agents: Readonly<Record<string, Readonly<Record<PromptLanguage, string>>>>;
}

const DIRECTIVES = readContractJson<LanguageDirectiveContract>("agent/shared/language.directives.json");

/** 에이전트와 언어에 맞는 출력 언어 지시문이며 모르는 언어는 auto로 되돌린다. */
export function languageDirective(agentId: string, language: string): string {
    const agent = DIRECTIVES.agents[agentId];
    if (agent === undefined) throw new Error(`no language directives for agent ${agentId}`);
    return language in agent ? agent[language as PromptLanguage] : agent.auto;
}
