import { buildAgentPrompt, type AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { readAgentPrompt, readAgentTools } from "~agent-worker/support/contract.js";
import type { RecipeToolContract } from "~agent-worker/domain/recipe/model/recipe.tool.schema.js";
import type { PromptSourcePort } from "~agent-worker/domain/recipe/port/prompt.source.port.js";

/** 계약이 선언한 조각을 읽고 상한 절과 조율자 도구 이름으로 자리표시자를 끝낸 프롬프트를 낸다. */
export class ContractPromptSourceAdapter implements PromptSourcePort {
    resolve(agentName: string): Promise<AgentPrompt> {
        const tools = readAgentTools<RecipeToolContract>(agentName);
        const coordinatorTool = tools.orchestration.coordinatorTools[0];
        if (coordinatorTool === undefined) throw new Error(`prompt.coordinator-tool-missing:${agentName}`);
        const values = { ...(tools.limits ?? {}), checkCitationsTool: coordinatorTool };
        return Promise.resolve(buildAgentPrompt(readAgentPrompt(agentName), values));
    }
}
