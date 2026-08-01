import { buildAgentPrompt, type AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { readAgentPrompt, readAgentTools } from "~agent-worker/support/contract.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import type { RecipeToolContract } from "~agent-worker/domain/recipe/model/recipe.tool.schema.js";
import type { PromptSourcePort } from "~agent-worker/domain/recipe/port/prompt.source.port.js";

const AGENT_NAME = AGENT.recipeScan.id;

/** 자리표시자 하나는 값이 아니라 조율자가 단독으로 쥐는 도구의 이름이다. */
function placeholderValues(): Readonly<Record<string, string | number>> {
    const tools = readAgentTools<RecipeToolContract>(AGENT_NAME);
    const coordinatorTool = tools.orchestration.coordinatorTools[0];
    if (coordinatorTool === undefined) throw new Error(`prompt.coordinator-tool-missing:${AGENT_NAME}`);
    return { ...(tools.limits ?? {}), checkCitationsTool: coordinatorTool };
}

// 계약을 읽지 못하면 실행이 아니라 기동에서 멈추도록 조립을 만드는 자리에서 끝낸다.
export class ContractPromptSourceAdapter implements PromptSourcePort {
    private readonly prompt: AgentPrompt = buildAgentPrompt(
        readAgentPrompt(AGENT_NAME),
        placeholderValues(),
    );

    resolve(agentName: string): Promise<AgentPrompt> {
        if (agentName !== AGENT_NAME) throw new Error(`prompt.agent-mismatch:${agentName}`);
        return Promise.resolve(this.prompt);
    }
}
