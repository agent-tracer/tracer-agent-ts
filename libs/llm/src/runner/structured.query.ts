import { AgentExecutionFailure, isRetryableSubtype } from "~llm/model/agent.error.js";
import { loadExecutionBudgetContract } from "~llm/model/execution.budget.schema.js";
import type { AgentQueryUsage } from "~llm/model/agent.usage.js";
import type { JobStepPayload } from "~llm/model/job.step.js";
import { parseJsonStrict } from "~llm/support/parse.json.js";
import type { AgentQueryRequest, IQueryRunner, OutputSchema } from "./llm.runner.js";

export interface StructuredQueryResult<T> {
    readonly data: T;
    readonly rawOutput: string;
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
    readonly steps: readonly JobStepPayload[];
    readonly landed: boolean;
    readonly providerRequestId: string | null;
}

const RUNNER_RETRY = loadExecutionBudgetContract().runnerRetry;

/** 다시 부르기 전에 기다리는 자리이며 시험이 벽시계를 기다리지 않도록 갈아 끼운다. */
export interface RetryPacer {
    wait(ms: number): Promise<void>;
    jitter(): number;
}

const DEFAULT_PACER: RetryPacer = {
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    jitter: () => Math.random(),
};

/** 같은 지연에 몰린 재시도가 공급자를 다시 밀지 않도록 물러섬에 흔들림을 준다. */
function backoffMs(attempt: number, pacer: RetryPacer): number {
    const { initialDelayMs, backoffFactor, jitter } = RUNNER_RETRY.transient;
    const base = initialDelayMs * backoffFactor ** attempt;
    return jitter ? Math.round(base * (0.5 + pacer.jitter() * 0.5)) : base;
}

/**
 * 실행과 오류 정규화와 JSON 파싱과 스키마 검증까지의 공통 경로를 한 곳에 모으고 다시 부르는 두 층을 감싼다.
 */
export async function runStructuredQuery<T, ProviderOptions = undefined>(
    runner: IQueryRunner<ProviderOptions>,
    request: AgentQueryRequest<ProviderOptions>,
    schema: OutputSchema<T>,
    pacer: RetryPacer = DEFAULT_PACER,
): Promise<StructuredQueryResult<T>> {
    const spent = { costUsd: 0, numTurns: 0 };
    let asked = request;
    for (let repair = 0; ; repair += 1) {
        try {
            const done = await runWithTransientRetry(runner, asked, schema, pacer, spent);
            return { ...done, costUsd: spent.costUsd, numTurns: spent.numTurns };
        } catch (error) {
            if (repair >= RUNNER_RETRY.schemaViolation.attempts || !isSchemaViolation(error)) throw error;
            // 규격을 한 번 어겼다고 그 시도를 접으면 그때까지 지불한 토큰이 전부 버려진다.
            asked = { ...asked, prompt: `${asked.prompt}\n\n${RUNNER_RETRY.schemaViolation.directive}` };
        }
    }
}

function isSchemaViolation(error: unknown): boolean {
    return error instanceof AgentExecutionFailure && error.code === "OUTPUT_SCHEMA_INVALID";
}

/** 공급자가 잠시 받지 못한 실패만 같은 자리에서 다시 부르고 소진되면 그대로 던진다. */
async function runWithTransientRetry<T, ProviderOptions>(
    runner: IQueryRunner<ProviderOptions>,
    request: AgentQueryRequest<ProviderOptions>,
    schema: OutputSchema<T>,
    pacer: RetryPacer,
    spent: { costUsd: number; numTurns: number },
): Promise<StructuredQueryResult<T>> {
    for (let attempt = 0; ; attempt += 1) {
        try {
            return await runOnce(runner, request, schema, spent);
        } catch (error) {
            const subtype = error instanceof AgentExecutionFailure ? error.errorSubtype : null;
            if (attempt >= RUNNER_RETRY.transient.attempts || !isRetryableSubtype(subtype)) throw error;
            await pacer.wait(backoffMs(attempt, pacer));
        }
    }
}

async function runOnce<T, ProviderOptions>(
    runner: IQueryRunner<ProviderOptions>,
    request: AgentQueryRequest<ProviderOptions>,
    schema: OutputSchema<T>,
    spent: { costUsd: number; numTurns: number },
): Promise<StructuredQueryResult<T>> {
    const result = await runner.run(request);
    spent.costUsd += result.costUsd ?? 0;
    spent.numTurns += result.numTurns ?? 0;
    const detail = {
        errorSubtype: result.errorSubtype,
        usage: result.usage,
        steps: result.steps,
        actualModel: result.actualModel,
        providerRequestId: result.providerRequestId,
        retryAfterMs: result.retryAfterMs ?? null,
        durationMs: result.durationMs,
    };

    // 예산이나 턴이 소진돼도 land 훅이 받아낸 부분 출력이 스키마를 통과하면 성공으로 보낸다.
    const json = result.structuredOutput ?? (result.rawOutput ? parseJsonStrict(result.rawOutput) : null);
    const parsed = json !== null && json !== undefined ? schema.safeParse(json) : null;
    if (parsed?.success === true) {
        return {
            data: parsed.data,
            rawOutput: result.rawOutput,
            // 단가 표의 키와 같은 별칭을 적어 한 기록의 model과 costUsd가 같은 모델을 가리킨다.
            modelUsed: request.model,
            durationMs: result.durationMs,
            costUsd: result.costUsd,
            numTurns: result.numTurns,
            usage: result.usage,
            steps: result.steps,
            landed: result.landed,
            providerRequestId: result.providerRequestId,
        };
    }

    if (result.errorSummary !== null || (!result.rawOutput && result.structuredOutput === null)) {
        throw new AgentExecutionFailure(
            request.label,
            "AGENT_FAILED",
            `Agent backend returned an error${result.errorSummary ? `: ${result.errorSummary}` : ""}`,
            detail,
        );
    }

    if (json === null || json === undefined) {
        throw new AgentExecutionFailure(request.label, "OUTPUT_NOT_JSON", "Agent output was not parseable JSON", {
            ...detail,
            errorSubtype: null,
            retryAfterMs: null,
        });
    }

    // 여기까지 왔으면 json은 성공도 OUTPUT_NOT_JSON도 아니므로 스키마 검증에 실패한 값이다.
    const invalid = schema.safeParse(json);
    throw new AgentExecutionFailure(
        request.label,
        "OUTPUT_SCHEMA_INVALID",
        `Agent output failed schema validation: ${invalid.success ? "" : invalid.error.message}`,
        { ...detail, errorSubtype: null, retryAfterMs: null },
    );
}
