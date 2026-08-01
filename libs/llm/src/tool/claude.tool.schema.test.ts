import { describe, expect, it } from "vitest";
import { readContractJson } from "~llm/support/contract.js";
import { callToolForModel } from "./claude.tool.schema.js";
import type { ToolFailureTexts } from "./tool.failure.js";

interface RedactionRule {
    readonly marker: string;
    readonly values: { readonly requiresTrailingBody: { readonly minLength: number } };
}

const RULE = readContractJson<RedactionRule>("agent/shared/redaction.json");
const BODY = "A".repeat(RULE.values.requiresTrailingBody.minLength);

const FAILURES: ToolFailureTexts = { toolFailed: "{tool} failed: {reason}" };

describe("모델의 다음 입력이 되는 도구 결과", () => {
    it("되읽은 자리의 자격 증명을 표시로 바꾸고 나머지는 그대로 준다", async () => {
        const handlers = {
            read: async () =>
                Promise.resolve(JSON.stringify({ callbackToken: "leak", title: "무해한 제목" })),
        };

        const text = await callToolForModel(handlers, "read", {}, FAILURES);

        expect(JSON.parse(text)).toEqual({ callbackToken: RULE.marker, title: "무해한 제목" });
    });

    it("구조가 없는 결과의 본문 안에서도 자격 증명을 가린다", async () => {
        const handlers = { read: async () => Promise.resolve(`설정 값은 sk-ant-${BODY} 이다`) };

        const text = await callToolForModel(handlers, "read", {}, FAILURES);

        expect(text).toBe(`설정 값은 ${RULE.marker} 이다`);
    });

    it("도구가 실패해도 실패 본문을 그대로 모델에게 준다", async () => {
        const handlers = {
            read: async () => Promise.reject(new Error("boom")),
        };

        const text = await callToolForModel(handlers, "read", {}, FAILURES);

        expect(text).toBe("read failed: boom");
    });
});
