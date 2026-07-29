import type { LlmToolDefinition, ToolFailureTexts } from "@tracer-agent/llm";
import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import { readContractJson } from "~agent-worker/support/contract.js";

/** 열거 인자의 허용값과, 있으면 기본값이다. */
interface ChatToolArgEnum {
    readonly default?: string;
    readonly values: readonly string[];
}

/** 수치 인자의 기본값과 상하한이다. */
interface ChatToolArgNumber {
    readonly default: number;
    readonly min: number;
    readonly max: number;
}

export type ChatToolArgSpec = ChatToolArgEnum | ChatToolArgNumber;

/** 한 도구의 계약이며 required와 optional과 mutation은 예약된 키이고 나머지는 인자의 제약이다. */
export type ChatToolSpec = {
    readonly required: readonly string[];
    readonly optional: readonly string[];
    readonly mutation: boolean;
} & {
    readonly [arg: string]: readonly string[] | boolean | ChatToolArgSpec;
};

export interface ChatToolContract {
    readonly tools: Readonly<Record<string, ChatToolSpec>>;
    readonly responses: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
    /** 확인 대기 응답에 싣는 안내이며 두 구현체가 같은 문장을 모델에게 보인다. */
    readonly proposalNote: string;
    readonly failures: ToolFailureTexts;
    readonly argDescriptions: Readonly<Record<string, Readonly<Record<string, string>>>>;
    readonly descriptions: Readonly<Record<string, string>>;
}

interface ChatSpecFile {
    readonly tools: ChatToolContract;
}

/** 두 구현체가 함께 읽는 도구 계약이며 값은 계약 저장소가 소유한다. */
export const CHAT_TOOL_CONTRACT: ChatToolContract =
    readContractJson<ChatSpecFile>("agent/chat/spec.json").tools;

/** 이 에이전트가 모델에게 여는 도구의 전체 이름이다. */
export const CHAT_TOOLS: readonly string[] = Object.keys(CHAT_TOOL_CONTRACT.tools);

/** 사용자에게 쓰기 확인 게이트를 세워야 하는 도구의 이름이다. */
export const CHAT_MUTATION_TOOLS: readonly string[] = CHAT_TOOLS.filter(
    (name) => CHAT_TOOL_CONTRACT.tools[name]!.mutation,
);

const RESERVED_TOOL_KEYS = new Set(["required", "optional", "mutation"]);

/** 예약된 키를 뺀 나머지 키로 도구의 인자 이름과 그 제약을 뽑아낸다. */
export function chatToolArgSpecs(spec: ChatToolSpec): ReadonlyMap<string, ChatToolArgSpec> {
    const args = new Map<string, ChatToolArgSpec>();
    for (const [key, value] of Object.entries(spec)) {
        if (!RESERVED_TOOL_KEYS.has(key)) args.set(key, value as ChatToolArgSpec);
    }
    return args;
}

function isEnumSpec(spec: ChatToolArgSpec): spec is ChatToolArgEnum {
    return "values" in spec;
}

function buildArg(argSpec: ChatToolArgSpec | undefined, isRequired: boolean, described: string): ZodTypeAny {
    let schema: ZodTypeAny;
    if (argSpec !== undefined && isEnumSpec(argSpec)) {
        schema = z.enum([...argSpec.values] as [string, ...string[]]);
    } else if (argSpec !== undefined) {
        schema = z.number().int().min(argSpec.min).max(argSpec.max);
    } else {
        schema = z.string().trim().min(1);
    }
    return (isRequired ? schema : schema.optional()).describe(described);
}

function buildShape(toolName: string, spec: ChatToolSpec): ZodRawShape {
    const specs = chatToolArgSpecs(spec);
    const described = CHAT_TOOL_CONTRACT.argDescriptions[toolName] ?? {};
    const shape: Record<string, ZodTypeAny> = {};
    for (const arg of spec.required) shape[arg] = buildArg(specs.get(arg), true, described[arg] ?? arg);
    for (const arg of spec.optional) shape[arg] = buildArg(specs.get(arg), false, described[arg] ?? arg);
    return shape;
}

/** 도구 이름별 zod shape이며 핸들러가 같은 shape로 인자를 파싱하고 좁힌다. */
export const CHAT_TOOL_SHAPES: Readonly<Record<string, ZodRawShape>> = Object.fromEntries(
    CHAT_TOOLS.map((name) => [name, buildShape(name, CHAT_TOOL_CONTRACT.tools[name]!)]),
);

/** 이 에이전트가 모델에게 여는 도구의 계약이며 이름과 설명과 shape 모두 계약에서 파생된다. */
export const CHAT_TOOL_DEFINITIONS: readonly LlmToolDefinition[] = CHAT_TOOLS.map((name) => ({
    name,
    description: CHAT_TOOL_CONTRACT.descriptions[name] ?? name,
    shape: CHAT_TOOL_SHAPES[name]!,
}));

export const CHAT_TOOL_NAMES: readonly string[] = [...CHAT_TOOLS];

/** 대화에는 rationale 필드가 없어 다른 에이전트와 문구가 갈라지므로 계약이 몫을 따로 갖는다. */
export const CHAT_TOOL_FAILURES: ToolFailureTexts = CHAT_TOOL_CONTRACT.failures;

/** 도구 이름에 맞는 계약 shape로 원본 인자를 파싱하며 모델이 낸 값의 타입을 좁힌다. */
export function parseChatToolArgs(toolName: string, raw: unknown): Record<string, unknown> {
    return z.object(CHAT_TOOL_SHAPES[toolName]!).parse(raw);
}

export function strArg(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
