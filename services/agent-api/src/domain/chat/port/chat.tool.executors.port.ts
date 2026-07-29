export const CHAT_TOOL_EXECUTORS = Symbol("ChatToolExecutors");

/** 승인된 쓰기 도구 하나를 실제로 실행하고, 대화에 남길 사람이 읽는 결과 문장을 낸다. */
export type ChatToolExecutor = (userId: string, args: Record<string, unknown>) => Promise<string>;

/** 도구 이름을 그 실행자에 잇는 레지스트리다. */
export type ChatToolExecutorRegistry = Readonly<Record<string, ChatToolExecutor>>;
