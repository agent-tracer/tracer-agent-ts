import { taskQueueName } from "~agent-worker/support/task.queue.js";
import { taskQueuePrefix } from "~agent-worker/config/task.queue.js";

/** 대화 실행의 워크플로와 액티비티가 도는 큐이며 접수와 워커가 함께 쓴다. */
export const CHAT_EXECUTION_TASK_QUEUE = taskQueueName(taskQueuePrefix(), "chat");

/** 잡 워크플로와 짧은 액티비티가 도는 큐이며 접수와 워커가 함께 쓴다. */
export const JOB_TASK_QUEUE = taskQueueName(taskQueuePrefix(), "jobs");

/** 최대 15분인 생성 액티비티가 짧은 액티비티의 슬롯을 굶기지 않도록 분리한 큐다. */
export const GENERATE_TASK_QUEUE = taskQueueName(taskQueuePrefix(), "generate");

/** 스레드 안의 실행을 하나씩 접는 스레드 워크플로의 이름이다. */
export const CHAT_THREAD_WORKFLOW = "chatThreadWorkflow";

/** 스레드 워크플로가 실행 하나마다 띄우는 자식 워크플로의 이름이다. */
export const CHAT_EXECUTION_WORKFLOW = "chatExecutionWorkflow";

/** 접수가 새 실행 식별자를 스레드 워크플로에 밀어 넣는 신호의 이름이다. */
export const CHAT_EXECUTION_ENQUEUE_SIGNAL = "enqueueChatExecution";

/** 대화 실행 갱신을 다른 replica의 열린 연결에 알리는 토픽이다. */
export const CHAT_EXECUTION_UPDATES_TOPIC = "chat.execution.updates";

/** 사용자의 열린 화면에 상태 전이를 알리는 토픽이다. */
export const NOTIFICATIONS_TOPIC = "notifications";

/** 잡 상태가 바뀌었음을 알리는 통지의 종류이며 값은 화면과 추적 서비스가 함께 읽는다. */
export const JOB_UPDATED_NOTIFICATION = "job.updated";

/** 워커 SDK가 지표를 노출하는 포트다. */
export const TEMPORAL_SDK_METRICS_PORT = 9466;
