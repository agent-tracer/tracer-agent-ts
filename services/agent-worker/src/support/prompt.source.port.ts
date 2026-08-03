import type { AgentPrompt } from "~agent-worker/support/agent.prompt.js";

/** 에이전트 이름으로 그 에이전트의 템플릿과 치환이 끝난 조각을 낸다. */
export interface PromptSourcePort {
    resolve(agentName: string): Promise<AgentPrompt>;
}
