import type { WireModelRate } from "@tracer-agent/llm";

/** 실행기가 자기 한도를 갖지 않으므로 카탈로그가 정한 한도를 봉투로 건넨다. */
export interface ChatExecutionLimits {
    readonly budgetUsd: number;
    readonly maxTurns: number;
    readonly maxOutputTokens: number;
}

/** 실행 시도 하나에만 유효한 draft 창구이며, 평문은 실행기가 쓰고 지문은 원장이 든다. */
export interface ChatExecutionDraftGrant {
    readonly url: string;
    readonly token: string;
    readonly tokenHash: string;
}

/** 실행기가 한 시도를 실행하는 데 필요한 카탈로그 값과 자격 전부다. */
export interface ChatExecutionEnvelope {
    readonly model: string;
    readonly apiKey: string;
    readonly modelRates: Readonly<Record<string, WireModelRate>>;
    readonly limits: ChatExecutionLimits;
    readonly deadlineMs: number;
    readonly readApiBaseUrl: string;
    readonly scopeToken: string;
    readonly toolDescriptions: Readonly<Record<string, string>>;
    readonly draft: ChatExecutionDraftGrant;
}
