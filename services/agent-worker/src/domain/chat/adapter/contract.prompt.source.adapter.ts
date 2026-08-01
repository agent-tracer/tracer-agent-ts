import { buildAgentPrompt, type AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { readAgentPrompt } from "~agent-worker/support/contract.js";
import type { PromptSourcePort } from "~agent-worker/domain/chat/port/prompt.source.port.js";

/** 계약이 선언한 조각을 읽어 자리표시자까지 끝낸 프롬프트를 낸다. */
export class ContractPromptSourceAdapter implements PromptSourcePort {
    // 대화는 상한 절을 갖지 않으므로 채울 자리표시자가 없다.
    resolve(agentName: string): Promise<AgentPrompt> {
        return Promise.resolve(buildAgentPrompt(readAgentPrompt(agentName)));
    }
}
