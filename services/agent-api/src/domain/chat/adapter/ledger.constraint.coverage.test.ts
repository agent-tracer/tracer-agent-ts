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
    ai_jobs_idempotency_key: "../../job/adapter/job.idempotency.contract.test.ts",
    ai_job_steps_job_attempt_seq: "아직 없음",
    chat_execution_steps_execution_attempt_seq: "아직 없음",
    chat_user_memories_unique: "아직 없음",
    chat_executions_requested_backend_check: "아직 없음",
};

const HERE = path.dirname(new URL(import.meta.url).pathname);
const COVERED = Object.entries(COVERED_BY).filter(([, where]) => where !== "아직 없음");

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

    // 파일이 있다는 것만으로는 그 제약에 부딪혔는지 알 수 없으므로 그 자리가 갖는 성질을 본다.
    it.each(COVERED.map(([name, where]) => ({ name, where })))(
        "$name 에 부딪히는 $where 가 실물 원장에 실제로 부딪힌다",
        ({ name, where }) => {
            const text = readFileSync(path.join(HERE, where), "utf8");

            // 거절이 있다는 것만 보면 다른 제약이 먼저 걸린 것을 이 제약의 거절로 읽는다.
            expect({
                실물: text.includes("startLedger"),
                거절: text.includes(".rejects."),
                이제약: text.includes(name),
            }).toEqual({ 실물: true, 거절: true, 이제약: true });
        },
    );
});
