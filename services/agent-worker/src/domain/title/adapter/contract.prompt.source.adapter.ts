import { buildAgentPrompt, type AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { readAgentPrompt, readAgentTools } from "~agent-worker/support/contract.js";
import type { PromptSourcePort } from "~agent-worker/domain/title/port/prompt.source.port.js";

/** 계약이 선언한 조각을 읽고 상한 절의 값으로 자리표시자를 끝낸 프롬프트를 낸다. */
export class ContractPromptSourceAdapter implements PromptSourcePort {
    resolve(agentName: string): Promise<AgentPrompt> {
        const limits = readAgentTools(agentName).limits ?? {};
        return Promise.resolve(buildAgentPrompt(readAgentPrompt(agentName), limits));
    }
}
