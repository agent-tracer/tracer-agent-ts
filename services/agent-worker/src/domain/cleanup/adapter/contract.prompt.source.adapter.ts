import { buildAgentPrompt, type AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { readAgentPrompt, readAgentTools } from "~agent-worker/support/contract.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import type { PromptSourcePort } from "~agent-worker/domain/cleanup/port/prompt.source.port.js";

const AGENT_NAME = AGENT.taskCleanup.id;

// 계약을 읽지 못하면 실행이 아니라 기동에서 멈추도록 조립을 만드는 자리에서 끝낸다.
export class ContractPromptSourceAdapter implements PromptSourcePort {
    private readonly prompt: AgentPrompt = buildAgentPrompt(
        readAgentPrompt(AGENT_NAME),
        readAgentTools(AGENT_NAME).limits ?? {},
    );

    resolve(agentName: string): Promise<AgentPrompt> {
        if (agentName !== AGENT_NAME) throw new Error(`prompt.agent-mismatch:${agentName}`);
        return Promise.resolve(this.prompt);
    }
}
