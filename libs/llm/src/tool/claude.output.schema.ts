import type { ZodType, ZodTypeDef } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/** 결과를 검증하는 파서와 모델이 볼 JSON Schema 가 함께 나오는 스키마 하나다. */
export type StructuredSchema<T> = ZodType<T, ZodTypeDef, unknown>;

// Claude 구조화 출력이 받지 않는 JSON Schema 키워드이며 길이·개수·수치 제약이 모두 여기 든다.
export const CLAUDE_UNSUPPORTED_SCHEMA_KEYWORDS: readonly string[] = [
    "minLength",
    "maxLength",
    "pattern",
    "minItems",
    "maxItems",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "multipleOf",
];

const UNSUPPORTED = new Set<string>(CLAUDE_UNSUPPORTED_SCHEMA_KEYWORDS);

// 스키마에서 지워지는 제약을 모델이 읽는 문장으로 옮기는 자리이며 상한의 정본은 zod 하나로 남는다.
const CONSTRAINT_SENTENCES: Record<string, (value: unknown) => string | null> = {
    minLength: (value) => (typeof value === "number" ? `At least ${value} characters.` : null),
    maxLength: (value) => (typeof value === "number" ? `At most ${value} characters.` : null),
    pattern: (value) => (typeof value === "string" ? `Must match the regular expression ${value}.` : null),
    minItems: (value) => (typeof value === "number" ? `At least ${value} items.` : null),
    maxItems: (value) => (typeof value === "number" ? `At most ${value} items.` : null),
    minimum: (value) => (typeof value === "number" ? `At least ${value}.` : null),
    maximum: (value) => (typeof value === "number" ? `At most ${value}.` : null),
    exclusiveMinimum: (value) => (typeof value === "number" ? `Greater than ${value}.` : null),
    exclusiveMaximum: (value) => (typeof value === "number" ? `Less than ${value}.` : null),
    multipleOf: (value) => (typeof value === "number" ? `A multiple of ${value}.` : null),
};

/** 지워진 제약을 선언 순서대로 문장으로 옮겨 같은 스키마가 언제나 같은 설명을 내게 한다. */
function describeStrippedConstraints(stripped: ReadonlyMap<string, unknown>): string[] {
    const sentences: string[] = [];
    for (const keyword of CLAUDE_UNSUPPORTED_SCHEMA_KEYWORDS) {
        if (!stripped.has(keyword)) continue;
        const sentence = CONSTRAINT_SENTENCES[keyword]?.(stripped.get(keyword));
        if (sentence !== null && sentence !== undefined) sentences.push(sentence);
    }
    return sentences;
}

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
    const stripped = new Map<string, unknown>();
    for (const [key, value] of Object.entries(node)) {
        if (UNSUPPORTED.has(key)) {
            stripped.set(key, value);
            continue;
        }
        converted[key] = value;
    }

    const sentences = describeStrippedConstraints(stripped);
    if (sentences.length > 0) {
        const existing = typeof converted["description"] === "string" ? converted["description"].trim() : "";
        converted["description"] = [existing, ...sentences].filter((part) => part.length > 0).join(" ");
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
