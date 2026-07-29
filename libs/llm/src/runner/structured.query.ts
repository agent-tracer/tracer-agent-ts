import { AgentExecutionFailure } from "~llm/model/agent.error.js";
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

/** 실행과 오류 정규화와 JSON 파싱과 스키마 검증까지의 공통 경로를 한 곳에 모은다. */
export async function runStructuredQuery<T, ProviderOptions = undefined>(
    runner: IQueryRunner<ProviderOptions>,
    request: AgentQueryRequest<ProviderOptions>,
    schema: OutputSchema<T>,
): Promise<StructuredQueryResult<T>> {
    const result = await runner.run(request);
    const detail = {
        errorSubtype: result.errorSubtype,
        usage: result.usage,
        steps: result.steps,
        actualModel: result.actualModel,
        providerRequestId: result.providerRequestId,
        retryAfterMs: result.retryAfterMs ?? null,
        durationMs: result.durationMs,
    };

    // 예산이나 턴이 소진돼도 land 훅이 받아낸 부분 출력이 스키마를 통과하면 성공으로 흘린다.
    const json = result.structuredOutput ?? (result.rawOutput ? parseJsonStrict(result.rawOutput) : null);
    const parsed = json !== null && json !== undefined ? schema.safeParse(json) : null;
    if (parsed?.success === true) {
        return {
            data: parsed.data,
            rawOutput: result.rawOutput,
            // 공급자가 실제로 응답한 모델을 우선하고 응답이 없던 경우에만 요청 모델로 대체한다.
            modelUsed: result.actualModel ?? request.model,
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
