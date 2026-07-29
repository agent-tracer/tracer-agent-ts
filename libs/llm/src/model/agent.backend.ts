/** 실행을 관측할 때 태그로 남는 배포 축의 이름이며, 이 이미지가 곧 그 축이라 값이 하나다. */
export const AGENT_BACKEND = {
    claudeSdk: "claude-sdk",
} as const;

export type AgentBackend = (typeof AGENT_BACKEND)[keyof typeof AGENT_BACKEND];
