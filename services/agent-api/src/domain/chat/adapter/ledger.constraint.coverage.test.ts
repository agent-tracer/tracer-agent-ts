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
    ai_job_steps_job_attempt_seq: "../../job/adapter/job.step.sequence.contract.test.ts",
    chat_execution_steps_execution_attempt_seq: "chat.step.sequence.contract.test.ts",
    chat_user_memories_unique: "chat.user.memory.contract.test.ts",
    chat_executions_requested_backend_check: "chat.thread.lock.contract.test.ts",
};

const HERE = path.dirname(new URL(import.meta.url).pathname);
const COVERED = Object.entries(COVERED_BY).filter(([, where]) => where !== "아직 없음");

/**
 * 대역이 그 제약을 흉내 내는지이며 흉내 내지 않는 자리는 대역이 실물보다 넓어져도 동작 시험이 조용하다.
 */
const MIMICKED_BY: Readonly<Record<string, string>> = {
    chat_executions_idempotency: "흉내 내지 않는다",
    chat_threads_summary_pairing: "흉내 내지 않는다",
    chat_executions_running_thread: "threadBusy 플래그로 대신하며 행을 세지 않는다",
    chat_executions_requested_backend_check: "흉내 내지 않는다",
    ai_jobs_idempotency_key: "흉내 내지 않는다",
    chat_user_memories_unique: "거절이 아니라 덮어쓰기로 흉내 낸다",
    chat_execution_steps_execution_attempt_seq: "흉내 내지 않는다",
    ai_job_steps_job_attempt_seq: "흉내 내지 않는다",
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

    // 대역이 실물보다 넓어지는 것은 동작 시험이 못 잡으므로 흉내 여부를 적어 그 비대칭을 보이게 한다.
    it("제약마다 대역이 흉내 내는지도 적는다", () => {
        expect(Object.keys(MIMICKED_BY).sort()).toEqual(Object.keys(COVERED_BY).sort());
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
