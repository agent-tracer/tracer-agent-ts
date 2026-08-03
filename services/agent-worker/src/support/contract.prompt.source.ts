import type { ContractToolFile } from "@tracer-agent/llm";
import { buildAgentPrompt, type AgentPrompt } from "~agent-worker/support/agent.prompt.js";
import { readAgentPrompt, readAgentTools } from "~agent-worker/support/contract.js";
import type { AgentId } from "~agent-worker/support/agent.const.js";
import type { PromptSourcePort } from "~agent-worker/support/prompt.source.port.js";

/** 값이 아니라 조율자가 부를 도구의 이름을 프롬프트에 싣는 에이전트가 갖는 절이다. */
interface CoordinatedToolFile extends ContractToolFile {
    readonly orchestration?: { readonly coordinatorTools?: readonly string[] };
}

/** snake_case 도구 이름을 프롬프트가 부르는 자리표시자 이름으로 옮긴다. */
function toolPlaceholder(toolName: string): string {
    const [head = "", ...rest] = toolName.split("_");
    const camel = rest.map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join("");
    return `${head}${camel}Tool`;
}

function placeholderValues(agentName: AgentId): Readonly<Record<string, string | number>> {
    const tools = readAgentTools<CoordinatedToolFile>(agentName);
    const values: Record<string, string | number> = { ...(tools.limits ?? {}) };
    for (const tool of tools.orchestration?.coordinatorTools ?? []) values[toolPlaceholder(tool)] = tool;
    return values;
}

// 계약을 읽지 못하면 실행이 아니라 기동에서 멈추도록 조립을 만드는 자리에서 끝낸다.
export class ContractPromptSource implements PromptSourcePort {
    private readonly prompt: AgentPrompt;

    constructor(private readonly agentName: AgentId) {
        this.prompt = buildAgentPrompt(readAgentPrompt(agentName), placeholderValues(agentName));
    }

    resolve(agentName: string): Promise<AgentPrompt> {
        if (agentName !== this.agentName) throw new Error(`prompt.agent-mismatch:${agentName}`);
        return Promise.resolve(this.prompt);
    }
}
