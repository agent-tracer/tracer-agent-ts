/** 실행 하나를 실행한 구현체를 가리키는 축이며 값의 목록은 계약의 AgentAxis 가 소유한다. */
export const AGENT_AXIS = {
    ts: "ts",
    python: "python",
} as const;

export type AgentAxis = (typeof AGENT_AXIS)[keyof typeof AGENT_AXIS];

/** 이 이미지가 곧 하나의 축이라 원장과 관측과 지표에 남는 값이 하나로 고정된다. */
export const AGENT_BACKEND: AgentAxis = AGENT_AXIS.ts;
