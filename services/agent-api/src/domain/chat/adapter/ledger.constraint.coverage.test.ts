import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACT_ROOT } from "~agent-api/support/contract.js";

const MIGRATIONS = path.join(CONTRACT_ROOT, "db", "migrations");

/** 실물이 갖는 제약마다 그것에 부딪히는 자리이며 대역은 이 제약들을 지우므로 여기 적힌 자리가 없으면 그 갈래는 한 번도 실행되지 않는다. */
const COVERED_BY: Readonly<Record<string, string>> = {
    chat_executions_idempotency: "chat.execution.contract.test.ts",
    chat_threads_summary_pairing: "chat.thread.summary.contract.test.ts",
    chat_executions_running_thread: "chat.thread.lock.contract.test.ts",
    ai_jobs_idempotency_key: "아직 없음",
    ai_job_steps_job_attempt_seq: "아직 없음",
    chat_execution_steps_execution_attempt_seq: "아직 없음",
    chat_user_memories_unique: "아직 없음",
    chat_executions_requested_backend_check: "아직 없음",
};

function migrationText(): string {
    return readdirSync(MIGRATIONS)
        .filter((name) => name.endsWith(".sql"))
        .map((name) => readFileSync(path.join(MIGRATIONS, name), "utf8"))
        .join("\n");
}

/** 계약이 원장에 세우는 유일 색인과 CHECK 의 이름이며 이름 없는 제약은 여기서 세지 않는다. */
function declaredConstraints(): readonly string[] {
    const sql = migrationText();
    const unique = [...sql.matchAll(/CREATE UNIQUE INDEX(?: IF NOT EXISTS)? "([a-z_]+)"/gu)];
    const checks = [...sql.matchAll(/CONSTRAINT "([a-z_]+)"\s+CHECK/gu)];
    return [...unique, ...checks].map((match) => match[1] as string).sort();
}

describe("실물 원장의 제약과 그것에 부딪히는 자리", () => {
    it("계약이 세우는 제약을 하나도 빠뜨리지 않고 적는다", () => {
        expect(declaredConstraints()).toEqual(Object.keys(COVERED_BY).sort());
    });

    // 실제 원장을 띄우는 자리는 파일 이름으로 가리키므로 그 파일이 사라지면 여기서 걸린다.
    it.each(Object.entries(COVERED_BY).filter(([, where]) => where !== "아직 없음"))(
        "%s 에 부딪히는 파일이 실재한다",
        (_name, where) => {
            expect(readdirSync(path.dirname(new URL(import.meta.url).pathname))).toContain(where);
        },
    );
});
