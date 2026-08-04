import {
    TOOL_SURFACE,
    contractToolDefinitions,
    contractToolShapes,
    type ContractToolFile,
    type LlmToolDefinition,
    type ToolFailureTexts,
} from "@tracer-agent/llm";
import { z, type ZodRawShape } from "zod";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { readAgentTools } from "~agent-worker/support/contract.js";

/** 대화 도구 선언이며 확인 대기 안내와 응답 칸을 함께 갖는다. */
export interface ChatToolContract extends ContractToolFile {
    readonly responses: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
    /** 확인 대기 응답에 싣는 안내이며 두 구현체가 같은 문장을 모델에게 보인다. */
    readonly proposalNote: string;
    /** 승인된 도구가 실행된 뒤 그 결과를 알리도록 지시하는 문장이다. */
    readonly approvalReportNote: string;
    readonly failures: ToolFailureTexts;
}

/** 두 구현체가 함께 읽는 도구 계약이며 값은 계약 저장소가 소유한다. */
export const CHAT_TOOL_CONTRACT: ChatToolContract = readAgentTools<ChatToolContract>(AGENT.chat.id);

/** 이 에이전트가 모델에게 여는 도구의 전체 이름이다. */
export const CHAT_TOOLS: readonly string[] = Object.keys(CHAT_TOOL_CONTRACT.tools);

/** 부르기 전에 사용자 확인을 받아야 하는 도구의 이름이다. */
export const CHAT_CONFIRM_TOOLS: readonly string[] = CHAT_TOOLS.filter(
    (name) => CHAT_TOOL_CONTRACT.tools[name]?.surface === TOOL_SURFACE.confirm,
);

/** 도구 이름별 zod shape이며 핸들러가 같은 shape으로 인자를 파싱하고 좁힌다. */
export const CHAT_TOOL_SHAPES: Readonly<Record<string, ZodRawShape>> =
    contractToolShapes(CHAT_TOOL_CONTRACT);

/** 이 에이전트가 모델에게 여는 도구의 계약이며 이름과 설명과 shape 모두 계약에서 파생된다. */
export const CHAT_TOOL_DEFINITIONS: readonly LlmToolDefinition[] =
    contractToolDefinitions(CHAT_TOOL_CONTRACT);

export const CHAT_TOOL_NAMES: readonly string[] = [...CHAT_TOOLS];

/** 대화에는 rationale 필드가 없어 다른 에이전트와 문구가 갈리므로 계약이 몫을 따로 갖는다. */
export const CHAT_TOOL_FAILURES: ToolFailureTexts = CHAT_TOOL_CONTRACT.failures;

/** 도구 이름에 맞는 계약 shape로 원본 인자를 파싱하며 모델이 낸 값의 타입을 좁힌다. */
export function parseChatToolArgs(toolName: string, raw: unknown): Record<string, unknown> {
    const shape = CHAT_TOOL_SHAPES[toolName];
    if (shape === undefined) throw new Error(`${toolName} is not a contract tool`);
    return z.object(shape).parse(raw);
}

export function strArg(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
