import {
    TOOL_SURFACE,
    contractToolDefinitions,
    contractToolShapes,
    type ContractToolFile,
    type ToolFailureTexts,
} from "@tracer-agent/llm";
import { z, type ZodRawShape } from "zod";
import { readContractJson } from "~agent-api/support/contract.js";

/** 대화 도구가 되읽거나 부르는 추적 API 자리의 표다. */
export interface ChatToolBindings {
    readonly bindings: Readonly<Record<string, unknown>>;
    readonly local: Readonly<Record<string, unknown>>;
}

/** 대화 도구 선언이며 확인 게이트와 응답 칸과 안내 문장을 함께 갖는다. */
export interface ChatToolContract extends ContractToolFile {
    readonly responses: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
    /** 확인을 받는 도구가 대기 응답에 싣는 안내이며 두 구현체가 같은 문장을 모델에게 보인다. */
    readonly proposalNote: string;
    readonly failures: ToolFailureTexts;
    readonly bindings: ChatToolBindings;
}

/** 두 구현체가 함께 읽는 도구 계약이며 값은 계약 저장소가 소유한다. */
export const CHAT_TOOL_CONTRACT: ChatToolContract =
    readContractJson<ChatToolContract>("agent/chat/tool.json");

/** 이 에이전트가 모델에게 여는 도구의 전체 이름이다. */
export const CHAT_TOOLS: readonly string[] = Object.keys(CHAT_TOOL_CONTRACT.tools);

/** 부르기 전에 사용자 확인을 받아야 하는 도구의 이름이다. */
export const CHAT_CONFIRM_TOOLS: readonly string[] = CHAT_TOOLS.filter(
    (name) => CHAT_TOOL_CONTRACT.tools[name]?.surface === TOOL_SURFACE.confirm,
);

/** 도구 이름별 설명이며 실행 봉투가 이 문장을 그대로 실어 보낸다. */
export const CHAT_TOOL_DESCRIPTIONS: Readonly<Record<string, string>> = Object.fromEntries(
    Object.entries(CHAT_TOOL_CONTRACT.tools).map(([name, tool]) => [name, tool.description]),
);

/** 도구 이름별 zod shape이며 실행자가 같은 shape으로 인자를 파싱하고 좁힌다. */
export const CHAT_TOOL_SHAPES: Readonly<Record<string, ZodRawShape>> =
    contractToolShapes(CHAT_TOOL_CONTRACT);

/** 이름과 설명과 인자 전부가 계약에서 나온 도구 선언이다. */
export const CHAT_TOOL_DEFINITIONS = contractToolDefinitions(CHAT_TOOL_CONTRACT);

/** 도구 이름에 맞는 계약 shape로 원본 인자를 파싱하며, 모델이 낸 값의 타입을 좁힌다. */
export function parseChatToolArgs(toolName: string, raw: unknown): Record<string, unknown> {
    const shape = CHAT_TOOL_SHAPES[toolName];
    if (shape === undefined) throw new Error(`${toolName} is not a contract tool`);
    return z.object(shape).parse(raw);
}
