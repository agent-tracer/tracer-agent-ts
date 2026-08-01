import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import type { LlmToolDefinition } from "./claude.tool.schema.js";
import type { ToolFailureTexts } from "./tool.failure.js";

/** 계약이 도구 인자에 쓰는 타입 어휘다. */
export const CONTRACT_ARG_TYPE = {
    string: "string",
    enum: "enum",
    integer: "integer",
    array: "array",
    object: "object",
} as const;

export type ContractArgType = (typeof CONTRACT_ARG_TYPE)[keyof typeof CONTRACT_ARG_TYPE];

/** 배열 인자가 담는 원소의 제약이다. */
export interface ContractToolArgItems {
    readonly type: "string";
    readonly trim?: boolean;
    readonly minLength?: number;
}

/** 도구 인자 하나에 계약이 적은 타입과 제약과 설명이다. */
export interface ContractToolArg {
    readonly type: ContractArgType;
    readonly required: boolean;
    readonly description: string;
    readonly trim?: boolean;
    readonly minLength?: number;
    readonly values?: readonly string[];
    readonly min?: number;
    readonly max?: number;
    readonly default?: string | number;
    readonly maxItems?: number;
    readonly items?: ContractToolArgItems;
}

/** 도구 하나가 갖는 설명과 인자이며 args의 선언 순서가 모델이 보는 순서다. */
export interface ContractTool {
    readonly description: string;
    readonly mutation?: boolean;
    readonly args: Readonly<Record<string, ContractToolArg>>;
}

/** 에이전트 하나의 도구 선언 파일이다. */
export interface ContractToolFile {
    readonly agent: string;
    readonly version: string;
    readonly tools: Readonly<Record<string, ContractTool>>;
    readonly failures: ToolFailureTexts;
    readonly limits?: Readonly<Record<string, number | string>>;
}

function stringArg(arg: ContractToolArg): ZodTypeAny {
    let schema = z.string();
    if (arg.trim === true) schema = schema.trim();
    if (arg.minLength !== undefined) schema = schema.min(arg.minLength);
    return schema;
}

function itemsArg(items: ContractToolArgItems): ZodTypeAny {
    let schema = z.string();
    if (items.trim === true) schema = schema.trim();
    if (items.minLength !== undefined) schema = schema.min(items.minLength);
    return schema;
}

function baseSchema(arg: ContractToolArg): ZodTypeAny {
    switch (arg.type) {
        case CONTRACT_ARG_TYPE.enum: {
            const values = arg.values ?? [];
            if (values.length === 0) throw new Error("contract-tool.enum-without-values");
            return z.enum([...values] as [string, ...string[]]);
        }
        case CONTRACT_ARG_TYPE.integer: {
            let schema = z.number().int();
            if (arg.min !== undefined) schema = schema.min(arg.min);
            if (arg.max !== undefined) schema = schema.max(arg.max);
            return schema;
        }
        case CONTRACT_ARG_TYPE.array: {
            if (arg.items === undefined) throw new Error("contract-tool.array-without-items");
            const schema = z.array(itemsArg(arg.items));
            return arg.maxItems !== undefined ? schema.max(arg.maxItems) : schema;
        }
        case CONTRACT_ARG_TYPE.object:
            return z.record(z.string(), z.unknown());
        default:
            return stringArg(arg);
    }
}

/** 계약이 적은 인자 하나를 zod 스키마로 만든다. */
export function contractArgSchema(arg: ContractToolArg): ZodTypeAny {
    const schema = baseSchema(arg);
    return (arg.required ? schema : schema.optional()).describe(arg.description);
}

/** 도구 하나의 인자 전부를 계약의 선언 순서대로 zod shape으로 만든다. */
export function contractToolShape(tool: ContractTool): ZodRawShape {
    return Object.fromEntries(
        Object.entries(tool.args).map(([name, arg]) => [name, contractArgSchema(arg)]),
    );
}

/** 도구 이름별 zod shape이며 핸들러가 같은 shape으로 인자를 파싱하고 좁힌다. */
export function contractToolShapes(file: ContractToolFile): Readonly<Record<string, ZodRawShape>> {
    return Object.fromEntries(
        Object.entries(file.tools).map(([name, tool]) => [name, contractToolShape(tool)]),
    );
}

/** 이름과 설명과 shape 전부가 계약에서 나온 도구 선언이다. */
export function contractToolDefinitions(file: ContractToolFile): readonly LlmToolDefinition[] {
    return Object.entries(file.tools).map(([name, tool]) => ({
        name,
        description: tool.description,
        shape: contractToolShape(tool),
    }));
}

/** 도구 인자 하나의 제약이며 계약에 없는 이름이면 거절한다. */
export function contractToolArg(
    file: ContractToolFile,
    toolName: string,
    argName: string,
): ContractToolArg {
    const arg = file.tools[toolName]?.args[argName];
    if (arg === undefined) throw new Error(`contract-tool.arg-missing:${toolName}.${argName}`);
    return arg;
}

/** 정수 인자가 값을 주지 않았을 때 쓰는 계약의 기본값이다. */
export function contractIntDefault(file: ContractToolFile, toolName: string, argName: string): number {
    const value = contractToolArg(file, toolName, argName).default;
    if (typeof value !== "number") throw new Error(`contract-tool.default-missing:${toolName}.${argName}`);
    return value;
}

/** 정수 인자에 계약이 건 상한이다. */
export function contractIntMax(file: ContractToolFile, toolName: string, argName: string): number {
    const value = contractToolArg(file, toolName, argName).max;
    if (value === undefined) throw new Error(`contract-tool.max-missing:${toolName}.${argName}`);
    return value;
}

/** 열거 인자가 허용하는 값이며 하나 이상임을 보장한다. */
export function contractEnumValues(
    file: ContractToolFile,
    toolName: string,
    argName: string,
): readonly [string, ...string[]] {
    const values = contractToolArg(file, toolName, argName).values ?? [];
    if (values.length === 0) throw new Error(`contract-tool.values-missing:${toolName}.${argName}`);
    return [...values] as [string, ...string[]];
}

/** 상한 하나를 수로 읽으며 계약에 없으면 거절한다. */
export function contractLimit(file: ContractToolFile, name: string): number {
    const value = file.limits?.[name];
    if (typeof value !== "number") throw new Error(`contract-tool.limit-missing:${file.agent}.${name}`);
    return value;
}
