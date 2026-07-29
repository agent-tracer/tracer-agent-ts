import type {
    EvaluationExecutionFailure,
    EvaluationExecutionLease,
    EvaluationExecutionLeaseInput,
    EvaluationExecutionSettlement,
    EvaluationExperimentFinalization,
} from "~agent-worker/domain/evaluation/model/evaluation.experiment.model.js";
import type { EvaluationExecutionClient } from "~agent-worker/domain/evaluation/port/evaluation.execution.client.port.js";

const PREFIX = "/internal/evaluation";

export class HttpEvaluationExecutionClient implements EvaluationExecutionClient {
    constructor(private readonly baseUrl: string, private readonly fetcher: typeof fetch = fetch) {}

    lease(input: EvaluationExecutionLeaseInput): Promise<EvaluationExecutionLease | null> {
        return this.request("/executions/lease", input) as Promise<EvaluationExecutionLease | null>;
    }

    async settle(input: EvaluationExecutionSettlement): Promise<void> {
        await this.request("/executions/settle", input);
    }

    async release(input: EvaluationExecutionFailure): Promise<void> {
        await this.request("/executions/release", input);
    }

    async finalize(input: EvaluationExperimentFinalization): Promise<void> {
        await this.request("/experiments/finalize", input);
    }

    private async request(path: string, body: unknown): Promise<unknown> {
        const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, "")}${PREFIX}${path}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`evaluation-internal-http-${response.status}`);
        if (response.status === 204) return undefined;
        return response.json();
    }
}
