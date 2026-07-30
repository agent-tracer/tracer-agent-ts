/** 배포가 준 접두사 뒤에 붙어 큐 하나를 가리키는 키이며 계약의 workflow/queues.yaml이 소유한다. */
export type TaskQueueKey = "chat" | "jobs" | "generate";

/** 배포가 준 접두사와 큐 키를 이어 완전한 큐 이름을 만든다. */
export function taskQueueName(prefix: string, key: TaskQueueKey): string {
    return `${prefix}-${key}`;
}
