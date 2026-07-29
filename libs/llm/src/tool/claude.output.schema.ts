import type { ZodType, ZodTypeDef } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// Claude 구조화 출력이 400으로 거부하는 JSON Schema 키워드이며 문자열 길이 제약은 받아들인다.
export const CLAUDE_UNSUPPORTED_SCHEMA_KEYWORDS: readonly string[] = [
    "minItems",
    "maxItems",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
];

const UNSUPPORTED = new Set<string>(CLAUDE_UNSUPPORTED_SCHEMA_KEYWORDS);

// properties와 $defs의 키는 필드 이름이므로 키워드 필터를 적용하지 않는다.
const SCHEMA_MAP_KEYWORDS = ["properties", "$defs", "definitions", "patternProperties"] as const;
const SCHEMA_LIST_KEYWORDS = ["anyOf", "allOf", "oneOf", "prefixItems"] as const;
const SCHEMA_VALUE_KEYWORDS = ["items", "not", "additionalProperties", "contains"] as const;

type SchemaNode = Record<string, unknown>;

function isSchemaNode(value: unknown): value is SchemaNode {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNullSchema(node: unknown): boolean {
    return isSchemaNode(node) && node["type"] === "null";
}

function isNodeList(value: unknown): value is readonly unknown[] {
    return Array.isArray(value);
}

function stripOptionalNull(schema: unknown): unknown {
    if (!isSchemaNode(schema)) return schema;

    const alternatives = schema["anyOf"];
    if (isNodeList(alternatives)) {
        const nonNull = alternatives.filter((alternative) => !isNullSchema(alternative));
        if (nonNull.length === 1) {
            const { anyOf: _anyOf, ...siblings } = schema;
            const alternative = nonNull[0];
            return isSchemaNode(alternative) ? { ...siblings, ...alternative } : siblings;
        }
        return { ...schema, anyOf: nonNull };
    }

    const type = schema["type"];
    if (isNodeList(type)) {
        const nonNull = type.filter((candidate) => candidate !== "null");
        return { ...schema, type: nonNull.length === 1 ? nonNull[0] : nonNull };
    }
    if (schema["nullable"] === true) {
        const { nullable: _nullable, ...rest } = schema;
        return rest;
    }
    return schema;
}

function toClaudeCompatibleSchema(node: unknown): unknown {
    if (!isSchemaNode(node)) return node;

    const converted: SchemaNode = {};
    for (const [key, value] of Object.entries(node)) {
        if (UNSUPPORTED.has(key)) continue;
        converted[key] = value;
    }

    for (const keyword of SCHEMA_MAP_KEYWORDS) {
        const map = converted[keyword];
        if (!isSchemaNode(map)) continue;
        converted[keyword] = Object.fromEntries(
            Object.entries(map).map(([name, child]) => [name, toClaudeCompatibleSchema(child)]),
        );
    }
    for (const keyword of SCHEMA_LIST_KEYWORDS) {
        const list = converted[keyword];
        if (!Array.isArray(list)) continue;
        converted[keyword] = list.map(toClaudeCompatibleSchema);
    }
    for (const keyword of SCHEMA_VALUE_KEYWORDS) {
        const child = converted[keyword];
        if (!isSchemaNode(child) && !Array.isArray(child)) continue;
        converted[keyword] = Array.isArray(child)
            ? child.map(toClaudeCompatibleSchema)
            : toClaudeCompatibleSchema(child);
    }

    const properties = converted["properties"];
    if (!isSchemaNode(properties)) return converted;

    const required = new Set(
        Array.isArray(converted["required"])
            ? converted["required"].filter((value): value is string => typeof value === "string")
            : [],
    );
    converted["properties"] = Object.fromEntries(
        Object.entries(properties).map(([name, child]) => [
            name,
            required.has(name) ? child : stripOptionalNull(child),
        ]),
    );
    return converted;
}

/** zod 스키마를 Claude 구조화 출력용 JSON 스키마로 바꾼다. */
export function zodToClaudeOutputSchema(schema: ZodType<unknown, ZodTypeDef, unknown>): Record<string, unknown> {
    const json = zodToJsonSchema(schema, { $refStrategy: "none" }) as Record<string, unknown>;
    delete json["$schema"];
    return toClaudeCompatibleSchema(json) as Record<string, unknown>;
}
