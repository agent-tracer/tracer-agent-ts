import { describe, expect, it } from "vitest";
import { readContractJson } from "./contract.js";
import {
    hasSuspect,
    isSuspectKey,
    isSuspectText,
    redactPayload,
    redactSerialized,
    redactText,
    REDACTION_MARKER,
    REDACTION_STAGE,
    stageDiscards,
} from "./redaction.js";

interface RedactionRule {
    readonly marker: string;
    readonly keys: { readonly words: readonly string[] };
    readonly values: {
        readonly words: readonly string[];
        readonly requiresTrailingBody: { readonly minLength: number };
    };
    readonly stages: Readonly<Record<string, { readonly onSuspect: string }>>;
}

const RULE = readContractJson<RedactionRule>("agent/shared/redaction.json");
const BODY = "A".repeat(RULE.values.requiresTrailingBody.minLength);
const SHORT_BODY = "A".repeat(RULE.values.requiresTrailingBody.minLength - 1);

/** 낱말 사이의 공백을 지운 이름과 밑줄로 이은 이름은 같은 자리를 가리킨다. */
function camelCase(word: string): string {
    const [head, ...rest] = word.split(" ");
    return [head, ...rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1))].join("");
}

describe("가리는 표시", () => {
    it("계약이 정한 글자를 쓴다", () => {
        expect(REDACTION_MARKER).toBe(RULE.marker);
    });
});

describe("key 를 견주는 절차", () => {
    it("계약이 적은 낱말을 품은 이름을 값과 무관하게 가린다", () => {
        for (const word of RULE.keys.words) {
            expect(isSuspectKey(camelCase(word))).toBe(true);
            expect(redactPayload({ [camelCase(word)]: "무해한 본문" })).toEqual({
                [camelCase(word)]: RULE.marker,
            });
        }
    });

    it("구분자가 다른 같은 낱말을 한 낱말로 모은다", () => {
        for (const word of RULE.keys.words) {
            expect(isSuspectKey(word.replace(/ /gu, "_"))).toBe(true);
            expect(isSuspectKey(word.replace(/ /gu, "-"))).toBe(true);
            expect(isSuspectKey(word.toUpperCase())).toBe(true);
        }
    });

    it("자격을 부르지 않는 이름은 지나간다", () => {
        expect(isSuspectKey("prompt")).toBe(false);
        expect(redactPayload({ prompt: "무해한 본문" })).toEqual({ prompt: "무해한 본문" });
    });
});

describe("값을 견주는 절차", () => {
    it("낱말 뒤에 자격의 몸통이 이어질 때만 가린다", () => {
        for (const word of RULE.values.words) {
            expect(isSuspectText(`${word}${BODY}`)).toBe(true);
            expect(isSuspectText(`${word}${SHORT_BODY}`)).toBe(false);
        }
    });

    it("자격을 말하기만 한 본문은 그대로 낸다", () => {
        const sentence = "The bearer of this token may read the thread";
        expect(redactText(sentence)).toBe(sentence);
    });

    it("낱말과 몸통 사이의 공백을 건너뛰고 가린다", () => {
        expect(redactText(`Authorization: Bearer ${BODY}`)).toBe(`Authorization: ${RULE.marker}`);
    });

    it("가린 자리 밖의 본문은 그대로 낸다", () => {
        expect(redactText(`앞말 sk-ant-${BODY} 뒷말`)).toBe(`앞말 ${RULE.marker} 뒷말`);
    });

    it("구분자를 지우지 않으므로 접두사의 모양이 뜻을 잃지 않는다", () => {
        expect(isSuspectText(`skant${BODY}`)).toBe(false);
    });
});

describe("직렬화된 본문", () => {
    it("구조가 있으면 걸린 자리만 표시로 바꾼다", () => {
        const serialized = redactSerialized(JSON.stringify({ scopeToken: "abc", title: "무해한 제목" }));

        expect(JSON.parse(serialized)).toEqual({ scopeToken: RULE.marker, title: "무해한 제목" });
    });

    it("구조가 없으면 본문 안의 걸린 자리를 바꾼다", () => {
        expect(redactSerialized(`키는 sk-ant-${BODY} 이다`)).toBe(`키는 ${RULE.marker} 이다`);
    });
});

describe("폐기 판정", () => {
    it("중첩된 자리 하나가 걸려도 payload 가 걸린 것으로 센다", () => {
        expect(hasSuspect({ rows: [{ meta: { password: "무해한 본문" } }] })).toBe(true);
        expect(hasSuspect({ rows: [{ meta: { title: "무해한 제목" } }] })).toBe(false);
    });

    it("계약이 폐기를 정한 자리만 폐기로 판정한다", () => {
        for (const stage of Object.values(REDACTION_STAGE)) {
            const discards = RULE.stages[stage]?.onSuspect === "discard";
            expect(stageDiscards(stage)).toBe(discards);
        }
    });
});
