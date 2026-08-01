import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    EXECUTION_SCOPE_TOKEN_PREFIX,
    issueExecutionScopeToken,
} from "./execution.scope.token.js";

interface ScopeTokenRule {
    readonly prefix: string;
    readonly payload: { readonly fields: readonly string[]; readonly encoding: string };
    readonly signature: { readonly algorithm: string; readonly encoding: string };
    readonly secret: { readonly variable: string };
    readonly lifetime: { readonly marginMs: number };
}

const CONTRACT_ROOT = join(process.cwd(), "contract");
const RULE = JSON.parse(
    readFileSync(join(CONTRACT_ROOT, "agent/shared/scope.token.json"), "utf8"),
) as ScopeTokenRule;

const NOW = new Date(1000);

describe("실행에 매인 자격", () => {
    it("계약이 정한 접두사를 쓴다", () => {
        expect(EXECUTION_SCOPE_TOKEN_PREFIX).toBe(RULE.prefix);
    });

    it("계약이 적은 네 칸을 계약이 정한 인코딩으로 싣는다", () => {
        process.env[RULE.secret.variable] = "secret";
        const token = issueExecutionScopeToken({
            userId: "local",
            executionId: "e1",
            ttlMs: 60_000,
            now: NOW,
        });
        const parts = (token ?? "").split(".");

        expect(parts).toHaveLength(3);
        expect(Object.keys(JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8")))).toEqual(
            [...RULE.payload.fields],
        );
    });

    it("서명 비밀이 없으면 발급하지 않는다", () => {
        delete process.env[RULE.secret.variable];

        expect(
            issueExecutionScopeToken({ userId: "local", executionId: "e1", ttlMs: 1, now: NOW }),
        ).toBeNull();
    });
});
