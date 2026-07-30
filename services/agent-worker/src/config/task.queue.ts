/** 배포가 접두사를 주지 않을 때 쓰는 값이며 한 축만 뜬 클러스터를 전제한다. */
const DEFAULT_TASK_QUEUE_PREFIX = "agent";

/** 배포가 주는 큐 접두사이며 나란히 띄워 비교할 때 두 구현체가 서로 다른 값을 받는다. */
export function taskQueuePrefix(): string {
    return process.env["AGENT_TASK_QUEUE_PREFIX"] ?? DEFAULT_TASK_QUEUE_PREFIX;
}
