import { buildAgentPrompt, type AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { readAgentPrompt } from "~agent-worker/support/contract.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import type { PromptSourcePort } from "~agent-worker/domain/chat/port/prompt.source.port.js";

// 계약을 읽지 못하면 실행이 아니라 기동에서 멈추도록 조립을 만드는 자리에서 끝낸다.
export class ContractPromptSourceAdapter implements PromptSourcePort {
    // 대화는 상한 절을 갖지 않으므로 채울 자리표시자가 없다.
    private readonly prompt: AgentPrompt = buildAgentPrompt(readAgentPrompt(AGENT.chat.id));

    resolve(agentName: string): Promise<AgentPrompt> {
        if (agentName !== AGENT.chat.id) throw new Error(`prompt.agent-mismatch:${agentName}`);
        return Promise.resolve(this.prompt);
    }
}
