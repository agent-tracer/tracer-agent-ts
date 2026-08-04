import {
    JOB_STEP_ROLE,
    jobStepCarriesContent,
    type JobStepPayload,
    type JobStepRole,
    type JobStepToolCall,
} from "~llm/model/job.step.js";

// 궤적 한 행의 content 상한이며 실행 백엔드와 같은 값이라 백엔드가 달라도 절단 지점이 같다.
export const MAX_STEP_CONTENT_BYTES = 32_000;

const encoder = new TextEncoder();

function capContent(value: string): { readonly content: string; readonly truncated: boolean } {
    const encoded = encoder.encode(value);
    if (encoded.byteLength <= MAX_STEP_CONTENT_BYTES) return { content: value, truncated: false };
    // stream 모드는 끝에 걸린 불완전한 멀티바이트 시퀀스를 버려 한글이 대체 문자로 남지 않는다.
    const decoder = new TextDecoder("utf-8");
    return {
        content: decoder.decode(encoded.slice(0, MAX_STEP_CONTENT_BYTES), { stream: true }),
        truncated: true,
    };
}

export interface AssistantStepInput {
    readonly content: string;
    readonly toolCalls?: readonly JobStepToolCall[];
    readonly inputTokens?: number | undefined;
    readonly outputTokens?: number | undefined;
    readonly cacheReadTokens?: number | undefined;
    readonly cacheCreationTokens?: number | undefined;
    readonly stopReason?: string | undefined;
}

export interface ToolStepInput {
    readonly toolName: string;
    readonly toolCallId: string;
    readonly content: string;
}

/** 백엔드가 달라도 같은 필드와 같은 seq 규칙으로 궤적을 남겨 서로 비교할 수 있게 한다. */
export class TrajectoryRecorder {
    private readonly steps: JobStepPayload[] = [];
    private lastStepAtMs: number;

    /** durationMs는 직전 스텝 이후 흐른 시간이라 어느 호출이 시간을 썼는지 궤적만 보고 답할 수 있다. */
    constructor(private readonly nowMs: () => number = () => Date.now()) {
        this.lastStepAtMs = nowMs();
    }

    assistant(step: AssistantStepInput): void {
        this.push(JOB_STEP_ROLE.assistant, step.content, {
            toolCalls: step.toolCalls ?? [],
            inputTokens: step.inputTokens,
            outputTokens: step.outputTokens,
            cacheReadTokens: step.cacheReadTokens,
            cacheCreationTokens: step.cacheCreationTokens,
            stopReason: step.stopReason,
        });
    }

    tool(step: ToolStepInput): void {
        this.push(JOB_STEP_ROLE.tool, step.content, {
            toolCalls: [],
            toolName: step.toolName,
            toolCallId: step.toolCallId,
        });
    }

    snapshot(): readonly JobStepPayload[] {
        return [...this.steps];
    }

    private push(
        role: JobStepRole,
        rawContent: string,
        rest: Omit<JobStepPayload, "seq" | "role" | "content" | "truncated">,
    ): void {
        const { content, truncated } = capContent(rawContent);
        const at = this.nowMs();
        const step = {
            seq: this.steps.length,
            role,
            content,
            truncated,
            durationMs: at - this.lastStepAtMs,
            ...rest,
        };
        // 텍스트도 도구 호출도 없는 응답은 궤적에 아무것도 싣지 못하므로 seq를 소비하지 않는다.
        if (!jobStepCarriesContent(step)) return;
        this.lastStepAtMs = at;
        this.steps.push(step);
    }
}
