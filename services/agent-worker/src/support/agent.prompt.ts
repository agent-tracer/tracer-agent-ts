const PLACEHOLDER = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/** 출력 언어를 고르지 않았을 때 쓰는 변형의 이름이다. */
const AUTO_LANGUAGE = "auto";

/** 어느 템플릿의 슬롯에도 들지 않고 언어마다 다른 본문을 갖는 조각의 이름이다. */
const LANGUAGE_DIRECTIVE = "languageDirective";

/** 치환이 끝난 조각 하나와 그 조각의 판이다. */
export interface AgentPromptSlot {
    readonly content: string;
    readonly version: string;
}

/** 템플릿 하나의 판과 그 템플릿이 채우는 슬롯이다. */
export interface AgentPromptTemplate {
    readonly version: string;
    readonly slots: Readonly<Record<string, AgentPromptSlot>>;
}

/** 계약이 적은 조각 하나이며 언어마다 다른 조각은 content 대신 byLanguage 를 갖는다. */
export interface PromptFragmentDeclaration {
    readonly version: string;
    readonly content?: readonly string[];
    readonly byLanguage?: Readonly<Record<string, readonly string[]>>;
    readonly placeholders?: readonly string[];
}

/** 에이전트 하나의 조각과 템플릿 선언이다. */
export interface PromptDeclarationFile {
    readonly agent: string;
    readonly fragments: Readonly<Record<string, PromptFragmentDeclaration>>;
    readonly templates: Readonly<Record<string, { readonly version: string; readonly slots: readonly string[] }>>;
}

/** 조립 함수가 받는 프롬프트이며 본문이 어디서 왔는지를 담지 않는다. */
export class AgentPrompt {
    constructor(
        readonly templates: Readonly<Record<string, AgentPromptTemplate>>,
        private readonly languageDirectives: Readonly<Record<string, string>>,
    ) {}

    /** 템플릿의 슬롯 하나에 들어갈 본문이며 없으면 거절한다. */
    slot(templateKey: string, slotName: string): string {
        const found = this.templates[templateKey]?.slots[slotName];
        if (found === undefined) throw new Error(`prompt.slot-missing:${templateKey}.${slotName}`);
        return found.content;
    }

    /** 템플릿 하나가 갖는 슬롯 이름 전부다. */
    slotNames(templateKey: string): readonly string[] {
        const template = this.templates[templateKey];
        if (template === undefined) throw new Error(`prompt.template-missing:${templateKey}`);
        return Object.keys(template.slots);
    }

    /** 이 프롬프트가 갖는 템플릿 이름 전부다. */
    templateKeys(): readonly string[] {
        return Object.keys(this.templates);
    }

    /** 계약이 이 에이전트의 템플릿에 매긴 판이며 템플릿마다 다르면 하나를 고를 수 없어 거절한다. */
    version(): string {
        const declared = new Set(Object.values(this.templates).map((template) => template.version));
        if (declared.size !== 1) throw new Error("prompt.template-versions-differ");
        return [...declared][0] as string;
    }

    /** 출력 언어에 맞는 지시문이며 모르는 언어는 auto 로 되돌린다. */
    languageDirective(language: string): string {
        const directive = this.languageDirectives[language] ?? this.languageDirectives[AUTO_LANGUAGE];
        if (directive === undefined) throw new Error("prompt.language-directive-missing");
        return directive;
    }
}

function render(lines: readonly string[], values: Readonly<Record<string, string | number>>): string {
    return lines.join("\n").replace(PLACEHOLDER, (_match, name: string) => {
        const value = values[name];
        if (value === undefined) throw new Error(`prompt.placeholder-value-missing:${name}`);
        return String(value);
    });
}

/** 계약의 선언과 자리표시자 값으로 조립 함수가 받을 프롬프트를 만든다. */
export function buildAgentPrompt(
    file: PromptDeclarationFile,
    values: Readonly<Record<string, string | number>> = {},
): AgentPrompt {
    const templates = Object.fromEntries(
        Object.entries(file.templates).map(([templateKey, template]) => [
            templateKey,
            {
                version: template.version,
                slots: Object.fromEntries(
                    template.slots.map((slotName) => [
                        slotName,
                        { content: fragmentContent(file, slotName, values), version: fragment(file, slotName).version },
                    ]),
                ),
            },
        ]),
    );
    return new AgentPrompt(templates, languageDirectives(file, values));
}

function fragment(file: PromptDeclarationFile, name: string): PromptFragmentDeclaration {
    const found = file.fragments[name];
    if (found === undefined) throw new Error(`prompt.fragment-missing:${file.agent}.${name}`);
    return found;
}

function fragmentContent(
    file: PromptDeclarationFile,
    name: string,
    values: Readonly<Record<string, string | number>>,
): string {
    const lines = fragment(file, name).content;
    if (lines === undefined) throw new Error(`prompt.fragment-content-missing:${file.agent}.${name}`);
    return render(lines, values);
}

function languageDirectives(
    file: PromptDeclarationFile,
    values: Readonly<Record<string, string | number>>,
): Readonly<Record<string, string>> {
    const byLanguage = fragment(file, LANGUAGE_DIRECTIVE).byLanguage;
    if (byLanguage === undefined) {
        throw new Error(`prompt.language-directive-missing:${file.agent}`);
    }
    return Object.fromEntries(
        Object.entries(byLanguage).map(([language, lines]) => [language, render(lines, values)]),
    );
}
