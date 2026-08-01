import { computePromptFragmentHash, extractPromptFragmentPlaceholders } from "@tracer-agent/llm";

const FRAGMENT_LANGUAGE = "en";

export interface PromptFragmentDefault {
    readonly codeName: string;
    readonly definitionKey: string;
    readonly defaultVersion: `v${number}`;
    readonly defaultContent: string;
    readonly contentHash: string;
    readonly placeholders: readonly string[];
}

export interface PromptFragmentBindingSpec {
    readonly templateKey: string;
    readonly fragmentSlot: string;
    readonly fragment: PromptFragmentDefault;
}

const PLACEHOLDER = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** 조각의 코드 이름은 에이전트와 자리 이름만으로 나오며 백엔드를 말하는 자리를 두지 않는다. */
export function promptFragmentCodeName(agentName: string, fragmentKey: string): string {
    return `${agentName}-${fragmentKey}`.replace(/-/gu, "_").toUpperCase();
}

export function definePromptFragment(fragment: {
    readonly agentName: string;
    readonly fragmentKey: string;
    readonly defaultVersion: `v${number}`;
    readonly defaultContent: string;
}): PromptFragmentDefault {
    return {
        codeName: promptFragmentCodeName(fragment.agentName, fragment.fragmentKey),
        definitionKey: `${fragment.agentName}.${fragment.fragmentKey}.${FRAGMENT_LANGUAGE}`,
        defaultVersion: fragment.defaultVersion,
        defaultContent: fragment.defaultContent,
        contentHash: computePromptFragmentHash(fragment.defaultContent),
        placeholders: extractPromptFragmentPlaceholders(fragment.defaultContent),
    };
}

export function renderPromptFragment(
    fragment: PromptFragmentDefault,
    placeholders: Readonly<Record<string, string | number>>,
): string {
    return fragment.defaultContent.replace(PLACEHOLDER, (_match, name: string) => {
        const value = placeholders[name];
        if (value === undefined) throw new Error(`unknown prompt placeholder: ${name}`);
        return String(value);
    });
}
