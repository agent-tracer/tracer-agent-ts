import { readContractJson } from "./contract.js";

interface RedactionMatching {
    readonly normalize: readonly string[];
}

interface RedactionRule {
    readonly marker: string;
    readonly matching: RedactionMatching;
    readonly keys: { readonly words: readonly string[] };
    readonly values: {
        readonly matching: RedactionMatching;
        readonly words: readonly string[];
        readonly requiresTrailingBody: {
            readonly skipSpaceBetween: boolean;
            readonly minLength: number;
        };
    };
    readonly stages: Readonly<Record<string, { readonly onSuspect: string }>>;
}

const RULE = readContractJson<RedactionRule>("agent/shared/redaction.json");

// 계약의 charset 은 영문자와 숫자와 - 와 _ 와 . 이며 자격의 몸통은 이 글자로만 이어진다.
const BODY_CHARACTER = /[A-Za-z0-9._-]/u;
const DISCARD = "discard";

const NORMALIZERS: Readonly<Record<string, (text: string) => string>> = {
    casefold: (text) => text.toLowerCase(),
    keepAlphanumeric: (text) => text.replace(/[^\p{L}\p{N}]+/gu, ""),
};

function normalize(text: string, steps: readonly string[]): string {
    return steps.reduce((folded, step) => {
        const procedure = NORMALIZERS[step];
        if (procedure === undefined) throw new Error(`계약이 적은 ${step} 절차를 이 구현이 갖지 않는다`);
        return procedure(folded);
    }, text);
}

const KEY_WORDS = RULE.keys.words.map((word) => normalize(word, RULE.matching.normalize));
const VALUE_WORDS = RULE.values.words.map((word) => normalize(word, RULE.values.matching.normalize));

/** 가린 자리를 대신하는 문자열이며 계약이 두 축에 같은 글자를 정한다. */
export const REDACTION_MARKER = RULE.marker;

/** 걸린 것을 가릴지 폐기할지가 자리마다 다르므로 자리의 이름을 계약과 같게 쓴다. */
export const REDACTION_STAGE = {
    trace: "trace",
    query: "query",
    output: "output",
} as const;

export type RedactionStage = (typeof REDACTION_STAGE)[keyof typeof REDACTION_STAGE];

/** 이 자리가 걸린 payload 를 통째로 내보내지 않는지 계약에서 읽는다. */
export function stageDiscards(stage: RedactionStage): boolean {
    return RULE.stages[stage]?.onSuspect === DISCARD;
}

/** 이 이름을 가진 자리는 값을 보지 않고 걸린다. */
export function isSuspectKey(key: string): boolean {
    const folded = normalize(key, RULE.matching.normalize);
    return KEY_WORDS.some((word) => folded.includes(word));
}

interface SuspectSpan {
    readonly start: number;
    readonly end: number;
}

/** 자격을 부르는 낱말과 그 뒤에 이어지는 몸통까지를 한 자리로 센다. */
function suspectSpans(text: string): readonly SuspectSpan[] {
    const folded = normalize(text, RULE.values.matching.normalize);
    const { skipSpaceBetween, minLength } = RULE.values.requiresTrailingBody;
    const spans: SuspectSpan[] = [];
    for (const word of VALUE_WORDS) {
        for (let at = folded.indexOf(word); at >= 0; at = folded.indexOf(word, at + word.length)) {
            let body = at + word.length;
            while (skipSpaceBetween && /\s/u.test(folded[body] ?? "")) body += 1;
            let end = body;
            while (BODY_CHARACTER.test(folded[end] ?? "")) end += 1;
            if (end - body >= minLength) spans.push({ start: at, end });
        }
    }
    return spans.sort((left, right) => left.start - right.start);
}

/** 자격 증명의 모양을 가진 자리가 본문에 있는지 본다. */
export function isSuspectText(text: string): boolean {
    return suspectSpans(text).length > 0;
}

/** 걸린 자리만 표시로 바꾸고 남은 본문은 그대로 낸다. */
export function redactText(text: string): string {
    // 접어서 길이가 달라지는 글자가 있으면 자리가 밀려 자격의 앞머리가 남으므로 본문을 통째로 가린다.
    if (text.toLowerCase().length !== text.length) {
        return isSuspectText(text) ? REDACTION_MARKER : text;
    }
    let cursor = 0;
    let redacted = "";
    for (const span of suspectSpans(text)) {
        if (span.start < cursor) continue;
        redacted += text.slice(cursor, span.start) + REDACTION_MARKER;
        cursor = span.end;
    }
    return cursor === 0 ? text : redacted + text.slice(cursor);
}

/** 구조가 있는 값의 걸린 자리마다 표시를 넣고 나머지 구조는 그대로 낸다. */
export function redactPayload(value: unknown): unknown {
    if (typeof value === "string") return redactText(value);
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(redactPayload);
    const redacted: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
        redacted[key] = isSuspectKey(key) ? REDACTION_MARKER : redactPayload(item);
    }
    return redacted;
}

/** 폐기를 정한 자리가 payload 하나를 통째로 버릴지 판정한다. */
export function hasSuspect(value: unknown): boolean {
    if (typeof value === "string") return isSuspectText(value);
    if (value === null || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(hasSuspect);
    return Object.entries(value).some(([key, item]) => isSuspectKey(key) || hasSuspect(item));
}

/** 직렬화된 본문을 구조가 있으면 자리마다, 없으면 본문 안에서 가린다. */
export function redactSerialized(text: string): string {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return redactText(text);
    }
    return JSON.stringify(redactPayload(parsed));
}
