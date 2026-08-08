import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { cleanupSuggestionsListSchema } from "~agent-worker/domain/cleanup/model/cleanup.suggestion.schema.js";
import { recipeCandidatesListSchema } from "~agent-worker/domain/recipe/model/recipe.scan.schema.js";
import { titleSuggestionsListSchema } from "~agent-worker/domain/title/model/title.suggestion.schema.js";
import { readAgentOutput } from "~agent-worker/support/contract.js";

type Node = Record<string, unknown>;

const AGENTS: readonly { readonly id: string; readonly schema: ZodType }[] = [
    { id: "recipe-scan", schema: recipeCandidatesListSchema },
    { id: "task-cleanup", schema: cleanupSuggestionsListSchema },
    { id: "title-suggestion", schema: titleSuggestionsListSchema },
];

function isNode(value: unknown): value is Node {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** JSON Pointer 한 개를 문서 뿌리에서 따라간다. */
function follow(root: Node, pointer: string): unknown {
    return pointer
        .replace(/^#\//u, "")
        .split("/")
        .reduce<unknown>((node, step) => (isNode(node) ? node[step] : undefined), root);
}

/** 계약이 같은 모양을 여러 자리에서 가리키므로 가리킨 자리를 펼쳐야 그 아래 제약이 보인다. */
function deref(root: Node, node: unknown): unknown {
    if (!isNode(node)) return node;
    const pointer = node["$ref"];
    return typeof pointer === "string" ? follow(root, pointer) : node;
}

/** 무엇을 거절하는지 적은 가지는 칸의 제약이 아니므로 제거한다. */
function branchesOf(node: Node): readonly unknown[] {
    const declared = node["anyOf"] ?? node["oneOf"] ?? node["allOf"];
    return Array.isArray(declared) ? declared : [];
}

/** 계약이 배열 항목에 건 최소 길이를 칸 경로와 함께 낸다. */
function itemMinLengths(
    root: Node,
    raw: unknown,
    path: readonly string[] = [],
    seen: ReadonlySet<unknown> = new Set(),
): { path: readonly string[] }[] {
    const node = deref(root, raw);
    if (!isNode(node) || seen.has(node)) return [];
    const walked = new Set([...seen, node]);
    const found: { path: readonly string[] }[] = [];
    for (const branch of branchesOf(node)) found.push(...itemMinLengths(root, branch, path, walked));

    const items = deref(root, node["items"]);
    if (node["type"] === "array" && isNode(items)) {
        if (items["type"] === "string" && typeof items["minLength"] === "number" && items["minLength"] >= 1) {
            found.push({ path });
        }
        found.push(...itemMinLengths(root, items, path, walked));
    }
    const properties = node["properties"];
    if (isNode(properties)) {
        for (const [name, child] of Object.entries(properties)) {
            found.push(...itemMinLengths(root, child, [...path, name], walked));
        }
    }
    return found;
}

/** 계약이 요구하는 칸만 채운 가장 작은 값을 만든다. */
function minimalValue(root: Node, raw: unknown): unknown {
    const node = deref(root, raw);
    if (!isNode(node)) return null;
    const branch = branchesOf(node).find((entry) => isNode(entry) && entry["type"] !== "null");
    if (branch !== undefined) return minimalValue(root, branch);

    if (typeof node["const"] === "string") return node["const"];
    const values = node["enum"];
    if (Array.isArray(values) && values.length > 0) return values[0];
    switch (node["type"]) {
        case "array": {
            const least = typeof node["minItems"] === "number" ? node["minItems"] : 0;
            return Array.from({ length: least }, () => minimalValue(root, node["items"]));
        }
        case "object": {
            const properties = isNode(node["properties"]) ? node["properties"] : {};
            const required = Array.isArray(node["required"]) ? node["required"] : [];
            return Object.fromEntries(
                required
                    .filter((name): name is string => typeof name === "string")
                    .map((name) => [name, minimalValue(root, properties[name])]),
            );
        }
        case "integer":
        case "number":
            return typeof node["minimum"] === "number" ? node["minimum"] : 1;
        case "boolean":
            return true;
        default:
            return "x";
    }
}

/** 그 경로의 배열에만 주어진 항목을 싣고 나머지는 계약이 받아들이는 값으로 채우며, 경로가 배열을 지나는 자리는 이름을 남기지 않으므로 걸음을 소비하지 않는다. */
function buildWithItem(root: Node, raw: unknown, path: readonly string[], item: string): unknown {
    const node = deref(root, raw);
    if (!isNode(node)) return null;
    const branch = branchesOf(node).find((entry) => isNode(deref(root, entry)) && deref(root, entry) !== null);
    if (branch !== undefined && node["type"] === undefined) return buildWithItem(root, branch, path, item);

    if (path.length === 0) return [item];
    if (node["type"] === "array") return [buildWithItem(root, node["items"], path, item)];
    if (node["type"] !== "object") return minimalValue(root, node);

    const properties = isNode(node["properties"]) ? node["properties"] : {};
    const base = minimalValue(root, node) as Node;
    const [step, ...rest] = path;
    if (step !== undefined) base[step] = buildWithItem(root, properties[step], rest, item);
    return base;
}

const CASES = AGENTS.flatMap(({ id, schema }) => {
    const declared = readAgentOutput(id).schema as Node;
    return itemMinLengths(declared, declared).map(({ path }) => ({
        id,
        field: path.join("."),
        schema,
        payload: buildWithItem(declared, declared, path, "   "),
        baseline: buildWithItem(declared, declared, path, "x"),
    }));
});

/** 위 순회기와 다른 길로 같은 제약의 수만 세며, 경로를 만들지도 방문을 억제하지도 않으므로 그 두 자리가 자리를 삼키면 두 수가 갈린다. */
function declaredCount(root: Node, raw: unknown, depth = 0): number {
    const node = deref(root, raw);
    if (!isNode(node) || depth > 40) return 0;
    let found = 0;
    for (const branch of branchesOf(node)) found += declaredCount(root, branch, depth + 1);
    if (node["type"] === "array") {
        const items = deref(root, node["items"]);
        if (isNode(items)) {
            if (items["type"] === "string" && typeof items["minLength"] === "number" && items["minLength"] >= 1) {
                found += 1;
            }
            found += declaredCount(root, items, depth + 1);
        }
    }
    const properties = node["properties"];
    if (isNode(properties)) {
        for (const child of Object.values(properties)) found += declaredCount(root, child, depth + 1);
    }
    return found;
}

describe("계약이 배열 항목에 건 최소 길이", () => {
    it("계약이 그 제약을 적어도 하나 갖는다", () => {
        expect(CASES.length).toBeGreaterThan(0);
    });

    // 검사가 조용히 적게 보는 것은 통과와 구분되지 않으므로 본 개수를 계약이 적은 수와 맞춘다.
    it.each(AGENTS)("$id 가 적은 제약을 하나도 빠뜨리지 않고 본다", ({ id }) => {
        const declared = readAgentOutput(id).schema as Node;

        expect(CASES.filter((entry) => entry.id === id).length).toBe(declaredCount(declared, declared));
    });

    // 같은 모양에 쓸 수 있는 항목을 실은 값이며, 이것이 통과해야 아래 거절이 빈 항목 때문임이 정해진다.
    it.each(CASES)("$id 의 $field 는 쓸 수 있는 항목을 통과시킨다", ({ schema, baseline }) => {
        expect(schema.safeParse(baseline).success).toBe(true);
    });

    it.each(CASES)("$id 의 $field 는 빈 항목을 거절한다", ({ schema, payload }) => {
        expect(schema.safeParse(payload).success).toBe(false);
    });
});
