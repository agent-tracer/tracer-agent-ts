import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import type {
    EvaluationExecutionFailure,
    EvaluationExecutionLease,
    EvaluationExecutionLeaseInput,
    EvaluationExecutionSettlement,
    EvaluationExperimentFinalization,
} from "~agent-worker/domain/evaluation/model/evaluation.experiment.model.js";
import type { EvaluationExecutionClient } from "~agent-worker/domain/evaluation/port/evaluation.execution.client.port.js";

const PREFIX = "/internal/evaluation";

/** 실행 원장을 소유한 agent-api 의 내부 창구를 부른다. */
export class HttpEvaluationExecutionClient implements EvaluationExecutionClient {
    constructor(private readonly baseUrl: string, private readonly fetcher: typeof fetch = fetch) {}

    async lease(input: EvaluationExecutionLeaseInput): Promise<EvaluationExecutionLease | null> {
        const { userId, ...body } = input;
        return await this.request("/executions/lease", userId, body) as EvaluationExecutionLease | null;
    }

    async settle(input: EvaluationExecutionSettlement): Promise<void> {
        const { userId, ...body } = input;
        await this.request("/executions/settle", userId, body);
    }

    async release(input: EvaluationExecutionFailure): Promise<void> {
        const { userId, ...body } = input;
        await this.request("/executions/release", userId, body);
    }

    async finalize(input: EvaluationExperimentFinalization): Promise<void> {
        const { userId, ...body } = input;
        await this.request("/experiments/finalize", userId, body);
    }

    private async request(path: string, userId: string, body: unknown): Promise<unknown> {
        const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, "")}${PREFIX}${path}`, {
            method: "POST",
            headers: { "content-type": "application/json", [MONITOR_USER_HEADER]: userId },
            body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`evaluation-internal-http-${response.status}`);
        if (response.status === 204) return null;
        // 계약의 모든 창구가 봉투를 쓰므로 여기서 벗겨 도메인이 봉투를 알지 않게 한다.
        const envelope = await response.json() as { readonly data?: unknown } | null;
        return envelope?.data ?? null;
    }
}
