export interface AgentDeadline {
    readonly controller: AbortController;
    readonly dispose: () => void;
}

// 호출부가 예외 메시지가 아니라 signal.reason의 타입으로 데드라인 초과를 구분한다.
export class DeadlineExceededError extends Error {
    constructor(deadlineMs: number) {
        super(`Agent query exceeded ${deadlineMs}ms deadline`);
        this.name = "DeadlineExceededError";
    }
}

/** 지정한 시간이 지나면 요청을 중단하는 데드라인을 만든다. */
export function createAgentDeadline(deadlineMs: number): AgentDeadline {
    const controller = new AbortController();
    const timer = setTimeout(() => {
        controller.abort(new DeadlineExceededError(deadlineMs));
    }, deadlineMs);
    if (typeof timer.unref === "function") timer.unref();
    return { controller, dispose: () => clearTimeout(timer) };
}
