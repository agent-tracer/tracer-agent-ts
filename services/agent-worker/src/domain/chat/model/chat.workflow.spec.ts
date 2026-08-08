export const CHAT_GENERATE_MAX_ATTEMPTS = 3;

/** 한 시도의 벽시계 상한을 넘겨 갱신이 끊긴 running만 주인이 사라진 것으로 본다. */
export const CHAT_RUNNING_LEASE_MS = 20 * 60_000;

/** 스레드가 다른 실행에 잠겨 준비를 못 한 것이며 이 실행의 실패가 아니다. */
export const CHAT_THREAD_BUSY_FAILURE = "chat.thread-busy";

export const CHAT_THREAD_BUSY_RETRY_MS = 60_000;

// 회수 유예를 넘겨 기다려야 잠긴 스레드가 풀리는 것을 보고 다시 가져갈 수 있다.
export const CHAT_THREAD_BUSY_MAX_ROUNDS = 45;

/** 다음 턴을 기다리며 스레드 워크플로가 살아 있는 시간이며 대화 간격보다 짧으면 매 턴이 차가운 시작이 된다. */
export const CHAT_THREAD_IDLE_TIMEOUT = "2 minutes";

/** 한 스레드 워크플로가 띄울 수 있는 자식 수이며 넘으면 이력을 접고 새 실행으로 이어간다. */
export const CHAT_THREAD_MAX_CHILDREN = 100;

/** 액티비티마다의 벽시계 상한과 시도 수이며 워크플로와 실행 구조 문서가 이 한 자리를 읽는다. */
export const CHAT_ACTIVITY_LIMITS = {
    prepareChatExecution: { startToClose: "2 minutes", maximumAttempts: 5 },
    generateChatExecution: {
        startToClose: "15 minutes",
        heartbeat: "30 seconds",
        maximumAttempts: CHAT_GENERATE_MAX_ATTEMPTS,
    },
    finalizeChatExecution: { startToClose: "2 minutes", maximumAttempts: 5 },
    failChatExecution: { startToClose: "1 minute", maximumAttempts: 5 },
    getNextChatExecution: { startToClose: "1 minute", maximumAttempts: 5 },
} as const;

export interface ChatThreadWorkflowInput {
    readonly threadId: string;
}

export interface ChatExecutionWorkflowInput {
    readonly executionId: string;
}

export interface FailChatExecutionInput extends ChatExecutionWorkflowInput {
    readonly error: string;
}
