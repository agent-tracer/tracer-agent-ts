/** 배포가 준 접두사 뒤에 붙어 큐 하나를 가리키는 키이며 계약의 workflow/queues.yaml이 소유한다. */
export type TaskQueueKey = "chat" | "jobs" | "generate";

/** 배포가 준 접두사와 큐 키를 이어 완전한 큐 이름을 만든다. */
export function taskQueueName(prefix: string, key: TaskQueueKey): string {
    return `${prefix}-${key}`;
}

/** 같은 접두사를 나눠 쓰는 큐 이름에서 생성 큐의 이름을 되돌리며 워크플로가 접두사를 직접 읽지 않게 한다. */
export function generateTaskQueueOf(taskQueue: string): string {
    const boundary = taskQueue.lastIndexOf("-");
    return taskQueueName(boundary < 0 ? taskQueue : taskQueue.slice(0, boundary), "generate");
}
