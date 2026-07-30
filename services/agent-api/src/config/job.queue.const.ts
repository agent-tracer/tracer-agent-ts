import { taskQueueName } from "~agent-api/support/task.queue.js";
import { taskQueuePrefix } from "~agent-api/config/task.queue.js";

/** 잡 워크플로와 짧은 액티비티가 도는 큐이며 접수와 워커가 함께 쓴다. */
export const JOB_TASK_QUEUE = taskQueueName(taskQueuePrefix(), "jobs");

/** 최대 15분인 생성 액티비티가 짧은 액티비티의 슬롯을 굶기지 않도록 분리한 큐다. */
export const GENERATE_TASK_QUEUE = taskQueueName(taskQueuePrefix(), "generate");

/** 잡 종류마다 접수가 기동하는 워크플로의 이름이며 로컬 실행 종류는 값을 갖지 않는다. */
export const JOB_WORKFLOW_BY_KIND: Readonly<Record<string, string>> = {
    "title.suggestion": "titleSuggestionWorkflow",
    "recipe.scan": "recipeScanWorkflow",
    "task.cleanup": "taskCleanupWorkflow",
};

/** 사용자의 열린 화면에 상태 전이를 알리는 토픽이다. */
export const NOTIFICATIONS_TOPIC = "notifications";

/** 잡 상태가 바뀌었음을 알리는 통지의 종류이며 값은 화면과 추적 서비스가 함께 읽는다. */
export const JOB_UPDATED_NOTIFICATION = "sdk_job.updated";
