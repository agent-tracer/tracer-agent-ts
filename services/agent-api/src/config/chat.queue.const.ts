import { taskQueueName } from "~agent-api/support/task.queue.js";
import { taskQueuePrefix } from "~agent-api/config/task.queue.js";

/** 대화 실행의 워크플로와 액티비티가 실행되는 큐이며 접수와 워커가 함께 쓴다. */
export const CHAT_EXECUTION_TASK_QUEUE = taskQueueName(taskQueuePrefix(), "chat");

/** 스레드 안의 실행을 하나씩 실행하는 스레드 워크플로의 이름이다. */
export const CHAT_THREAD_WORKFLOW = "chatThreadWorkflow";

/** 접수가 새 실행 식별자를 스레드 워크플로에 보내 넣는 신호의 이름이다. */
export const CHAT_EXECUTION_ENQUEUE_SIGNAL = "enqueueChatExecution";

/** 한 시도의 벽시계 상한을 넘겨 갱신이 끊긴 running만 주인이 사라진 것으로 본다. */
export const CHAT_RUNNING_LEASE_MS = 20 * 60_000;

/** 대화 실행 갱신을 다른 replica의 열린 연결에 알리는 토픽이다. */
export const CHAT_EXECUTION_UPDATES_TOPIC = "chat.execution.updates";
