import { ApplicationFailure, Context } from "@temporalio/activity";
import { errorMessage, logError, logInfo, logWarn } from "@tracer-agent/platform";
import { AgentExecutionFailure } from "~llm/model/agent.error.js";

/** 같은 봉투로 다시 태워도 같은 자리에서 끝날 실패인지를, 그 실패를 아는 도메인이 판정한다. */
export type NonRetryableVerdict = (error: Error) => boolean;

export interface ActivityGuardScope {
    readonly activity: string;
    /** 로그와 대시보드가 이 활동의 실행 하나를 지목하는 상관 식별자다. */
    readonly jobId: string;
    readonly isNonRetryable: NonRetryableVerdict;
}

/** 재시도의 소유자는 오케스트레이션 엔진 하나이므로 활동은 판정과 대기 시간만 얹어 실패를 올린다. */
export async function guardActivity<T>(scope: ActivityGuardScope, run: () => Promise<T>): Promise<T> {
    const { activity, jobId } = scope;
    const attempt = Context.current().info.attempt;
    const startedAt = Date.now();
    try {
        const result = await run();
        logInfo({
            msg: "temporal.activity.completed",
            activity,
            jobId,
            attempt,
            durationMs: Date.now() - startedAt,
        });
        return result;
    } catch (err) {
        const durationMs = Date.now() - startedAt;
        if (!(err instanceof Error)) throw err;
        if (scope.isNonRetryable(err)) {
            logError({
                msg: "temporal.activity.abandoned",
                activity,
                jobId,
                attempt,
                durationMs,
                error: errorMessage(err),
            });
            throw ApplicationFailure.nonRetryable(err.message, err.name, err);
        }
        if (err instanceof AgentExecutionFailure && err.retryAfterMs !== null) {
            logWarn({
                msg: "temporal.activity.rate_limited",
                activity,
                jobId,
                attempt,
                durationMs,
                nextRetryDelay: err.retryAfterMs,
                error: errorMessage(err),
            });
            throw ApplicationFailure.create({
                message: err.message,
                type: err.name,
                nonRetryable: false,
                cause: err,
                nextRetryDelay: err.retryAfterMs,
            });
        }
        logError({
            msg: "temporal.activity.failed",
            activity,
            jobId,
            attempt,
            durationMs,
            error: errorMessage(err),
        });
        throw err;
    }
}
