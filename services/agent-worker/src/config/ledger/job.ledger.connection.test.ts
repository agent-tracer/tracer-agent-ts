import path from "node:path";
import { AGENT_BACKEND, type AgentRunObservation } from "@tracer-agent/llm";
import {
    LEDGER_CONTAINER_STARTUP_MS,
    startLedger,
    type StartedLedger,
} from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CleanupJobLedgerAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.job.ledger.adapter.js";
import { CleanupSettingReaderAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.setting.reader.adapter.js";
import { RecipeJobLedgerAdapter } from "~agent-worker/domain/recipe/adapter/recipe.job.ledger.adapter.js";
import { RecipeSettingReaderAdapter } from "~agent-worker/domain/recipe/adapter/recipe.setting.reader.adapter.js";
import { TitleJobLedgerAdapter } from "~agent-worker/domain/title/adapter/title.job.ledger.adapter.js";
import { TitleSettingReaderAdapter } from "~agent-worker/domain/title/adapter/title.setting.reader.adapter.js";
import { CONTRACT_ROOT } from "~agent-worker/support/contract.js";
import { JOB_ATTEMPT_STATUS } from "~agent-worker/support/llm/job.attempt.js";
import { AgentRunObservationEntity } from "./agent.run.observation.entity.js";
import { AiJobEntity } from "./ai.job.entity.js";
import { AiJobStepEntity } from "./ai.job.step.entity.js";

// 풀을 하나로 세워야 한 잡이 연결을 몇 개 요구하는지가 통과와 실패로 갈린다.
const POOL = { size: 1, acquireTimeoutMs: 700 };
const NOW = new Date("2026-07-14T00:00:00.000Z");
const SETTING_SCOPE = "user-1";
const SETTING_KEY = "anthropic.api_key";

let ledger: StartedLedger;

beforeAll(async () => {
    ledger = await startLedger(
        path.join(CONTRACT_ROOT, "db", "migrations"),
        [AiJobEntity, AiJobStepEntity, AgentRunObservationEntity],
        POOL,
    );
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
    // 설정 표는 엔티티로 선언하지 않아 truncate 대상이 아니므로 케이스마다 직접 비우고 다시 기록한다.
    await ledger.source.query(`DELETE FROM app_settings`);
    await ledger.source.query(
        `INSERT INTO app_settings (scope, key, value, updated_at) VALUES ($1, $2, $3, $4)`,
        [SETTING_SCOPE, SETTING_KEY, "sk-test", NOW],
    );
});

async function seedJob(kind: string): Promise<string> {
    const id = `job-${kind}`;
    await ledger.source.query(
        `INSERT INTO ai_jobs (id, user_id, kind, executor, backend, status, attempts, input, result, usage, created_at, updated_at)
         VALUES ($1, $2, $3, 'server', $4, 'pending', 0, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, $5, $5)`,
        [id, SETTING_SCOPE, kind, AGENT_BACKEND, NOW],
    );
    return id;
}

function observation(jobId: string): AgentRunObservation {
    return {
        executionId: jobId,
        attemptId: "1",
        jobId,
        agentName: "job-ledger-connection",
        backend: AGENT_BACKEND,
        modelRequested: "claude-haiku-4-5",
        modelActual: "claude-haiku-4-5",
        promptVersion: "v0.0.1",
        toolContractVersion: "v0.0.1",
        status: "succeeded",
        durationMs: 1,
        ttftMs: null,
        usage: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0 },
        costUsd: 0.01,
        landed: false,
        repairAttempted: false,
        validation: { passed: true, errorCodes: [], citationPrecision: null, citationRecall: null },
        modelCalls: [],
        toolCalls: [],
    };
}

describe("잡 원장과 설정 표를 나눠 든 슬라이스가 쥐는 연결", () => {
    it("레시피 스캔은 풀 상한 하나에서 설정을 읽고 잡을 종결한다", async () => {
        const jobId = await seedJob("recipe-scan");
        const jobs = new RecipeJobLedgerAdapter(ledger.source);
        const settings = new RecipeSettingReaderAdapter(ledger.source);

        expect(await jobs.findJob(jobId)).not.toBeNull();
        expect(await settings.findValue(SETTING_SCOPE, SETTING_KEY)).toBe("sk-test");
        expect(await jobs.startJob(jobId, NOW)).toBe(true);
        const settled = await jobs.commitScan({
            jobId,
            userId: SETTING_SCOPE,
            recipes: [],
            provenance: { eventIdsByTask: {}, turnIdsByTask: {}, ruleIds: [], recipeRevs: {} },
            steps: [],
            attempt: 1,
            usage: {},
            observation: observation(jobId),
            now: NOW,
        });

        expect(settled).toEqual({ candidatesCreated: 0 });
    });

    it("정리 제안은 풀 상한 하나에서 설정을 읽고 잡을 종결한다", async () => {
        const jobId = await seedJob("task-cleanup");
        const jobs = new CleanupJobLedgerAdapter(ledger.source);
        const settings = new CleanupSettingReaderAdapter(ledger.source);

        expect(await jobs.findJob(jobId)).not.toBeNull();
        expect(await settings.findValue(SETTING_SCOPE, SETTING_KEY)).toBe("sk-test");
        expect(await jobs.startJob(jobId, NOW)).toBe(true);
        const settled = await jobs.commitCleanup({
            jobId,
            userId: SETTING_SCOPE,
            tasksScanned: 0,
            suggestions: [],
            steps: [],
            attempt: 1,
            usage: {},
            observation: observation(jobId),
            now: NOW,
        });

        expect(settled).toEqual({ suggestionsCreated: 0 });
    });

    it("제목 제안은 풀 상한 하나에서 설정을 읽고 잡을 종결한다", async () => {
        const jobId = await seedJob("title-suggestion");
        const jobs = new TitleJobLedgerAdapter(ledger.source);
        const settings = new TitleSettingReaderAdapter(ledger.source);

        expect(await jobs.findJob(jobId)).not.toBeNull();
        expect(await settings.findValue(SETTING_SCOPE, SETTING_KEY)).toBe("sk-test");
        expect(await jobs.startJob(jobId, NOW)).toBe(true);
        const settled = await jobs.commitSuggestions({
            jobId,
            userId: SETTING_SCOPE,
            suggestions: [],
            steps: [],
            attempt: 1,
            usage: {},
            observation: observation(jobId),
            now: NOW,
        });

        expect(settled).toEqual({ suggestionsCreated: 0 });
    });

    it("실패 시도 기록도 같은 상한에서 원장과 관측을 한 커밋에 담는다", async () => {
        const jobId = await seedJob("recipe-scan-failure");
        const jobs = new RecipeJobLedgerAdapter(ledger.source);
        await jobs.startJob(jobId, NOW);

        await jobs.recordFailedAttempt({
            jobId,
            userId: SETTING_SCOPE,
            steps: [],
            record: {
                attempt: 1,
                status: JOB_ATTEMPT_STATUS.failed,
                subtype: null,
                model: null,
                costUsd: 0.01,
                durationMs: 1,
                usage: null,
                errorMessage: "실행이 실패했다",
                providerRequestId: null,
            },
            observation: observation(jobId),
            now: NOW,
        });

        const rows: unknown = await ledger.source.query(
            `SELECT count(*)::int AS n FROM agent_run_observations WHERE job_id = $1`,
            [jobId],
        );
        expect((rows as readonly { readonly n: number }[])[0]?.n).toBe(1);
    });
});
