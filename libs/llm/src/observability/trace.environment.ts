const TRACING_SWITCH = "LANGSMITH_TRACING";

// 추적 창구를 부르려면 주소와 사업과 자격이 다 있어야 하며 하나라도 비면 아무것도 나가지 않는다.
const REQUIRED_WHEN_ON = ["LANGSMITH_ENDPOINT", "LANGSMITH_PROJECT", "LANGSMITH_API_KEY"] as const;

/** 이 프로세스가 실행을 바깥 추적 창구로 내보내는지 본다. */
export function isTracingEnabled(): boolean {
    return process.env[TRACING_SWITCH] === "true";
}

/** 추적을 켠 프로세스가 창구를 부를 값을 다 갖췄는지 기동에서 확인한다. */
export function assertTraceEnvironment(): void {
    if (!isTracingEnabled()) return;
    const missing = REQUIRED_WHEN_ON.filter((key) => (process.env[key] ?? "").length === 0);
    if (missing.length > 0) {
        throw new Error(`${TRACING_SWITCH} 가 켜졌으나 ${missing.join(", ")} 가 비었다`);
    }
}
