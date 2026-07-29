export const READINESS_PROBE = Symbol("READINESS_PROBE");

/** agent-api가 요청을 받기 전에 원장 의존성을 점검한다. */
export interface ReadinessProbe {
    ping(): Promise<void>;
}
