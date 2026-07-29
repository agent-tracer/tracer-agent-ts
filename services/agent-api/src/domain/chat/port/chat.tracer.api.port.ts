export const CHAT_TRACER_API_BASE_URL = Symbol("ChatTracerApiBaseUrl");
export const CHAT_AGENT_API_BASE_URL = Symbol("ChatAgentApiBaseUrl");

/** 대화 도구가 기록을 읽고 되돌려 보내는 추적 API의 기점이다. */
export type ChatTracerApiBaseUrlPort = string;

/** 실행기가 draft를 통지하러 되돌아오는 이 서비스의 기점이다. */
export type ChatAgentApiBaseUrlPort = string;
