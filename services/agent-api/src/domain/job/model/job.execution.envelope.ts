import type { WireModelRate } from "@tracer-agent/llm";

/** 실행기가 자기 한도를 갖지 않으므로 카탈로그가 정한 한도를 봉투로 건넨다. */
export interface JobExecutionLimits {
    readonly budgetUsd: number;
    readonly maxTurns: number;
    readonly maxOutputTokens: number;
}

/** 실행기가 잡 한 시도를 태우는 데 필요한 카탈로그 값과 자격 전부다. */
export interface JobExecutionEnvelope {
    readonly model: string;
    readonly fallbackModel: string | null;
    readonly apiKey: string;
    readonly modelRates: Readonly<Record<string, WireModelRate>>;
    readonly limits: JobExecutionLimits;
    readonly deadlineMs: number;
}
