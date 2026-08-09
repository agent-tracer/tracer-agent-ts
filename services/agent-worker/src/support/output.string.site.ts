type Node = Record<string, unknown>;

/** 계약 출력 스키마가 문자열 한 칸에 건 제약이며 경로는 그 칸까지의 속성 이름만 갖는다. */
export interface StringSite {
    readonly path: readonly string[];
    readonly inArray: boolean;
    readonly minLength?: number;
    readonly maxLength?: number;
}

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
export function deref(root: Node, node: unknown): unknown {
    if (!isNode(node)) return node;
    const pointer = node["$ref"];
    return typeof pointer === "string" ? follow(root, pointer) : node;
}

/** 무엇을 거절하는지 적은 가지는 칸의 제약이 아니므로 제거한다. */
export function branchesOf(node: Node): readonly unknown[] {
    const declared = node["anyOf"] ?? node["oneOf"] ?? node["allOf"];
    return Array.isArray(declared) ? declared : [];
}

/** 값이 없다는 뜻을 함께 적은 칸도 글이 실릴 수 있는 칸이다. */
function isText(node: unknown): node is Node {
    if (!isNode(node)) return false;
    const type = node["type"];
    return type === "string" || (Array.isArray(type) && type.includes("string"));
}

function siteOf(path: readonly string[], inArray: boolean, node: Node): StringSite {
    const min = node["minLength"];
    const max = node["maxLength"];
    return {
        path,
        inArray,
        ...(typeof min === "number" ? { minLength: min } : {}),
        ...(typeof max === "number" ? { maxLength: max } : {}),
    };
}

/** 계약 출력 스키마가 갖는 문자열 칸을 전부 낸다. */
export function stringSitesOf(
    root: Node,
    raw: unknown = root,
    path: readonly string[] = [],
    seen: ReadonlySet<unknown> = new Set(),
): readonly StringSite[] {
    const node = deref(root, raw);
    if (!isNode(node) || seen.has(node)) return [];
    const walked = new Set([...seen, node]);
    const found: StringSite[] = [];
    for (const branch of branchesOf(node)) found.push(...stringSitesOf(root, branch, path, walked));

    const items = deref(root, node["items"]);
    if (node["type"] === "array" && isNode(items)) {
        if (isText(items)) found.push(siteOf(path, true, items));
        found.push(...stringSitesOf(root, items, path, walked));
    }
    const properties = node["properties"];
    if (isNode(properties)) {
        for (const [name, child] of Object.entries(properties)) {
            const at = [...path, name];
            const resolved = deref(root, child);
            if (isText(resolved)) found.push(siteOf(at, false, resolved));
            found.push(...stringSitesOf(root, child, at, walked));
        }
    }
    return found;
}

/** 계약이 요구하는 칸만 채운 가장 작은 값을 만든다. */
export function minimalValue(root: Node, raw: unknown): unknown {
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

/** 그 경로가 이 가지 아래에 있는지 본다. */
function reaches(root: Node, raw: unknown, path: readonly string[]): boolean {
    const node = deref(root, raw);
    if (!isNode(node)) return false;
    if (path.length === 0) return true;
    if (branchesOf(node).some((branch) => reaches(root, branch, path))) return true;
    if (node["type"] === "array") return reaches(root, node["items"], path);
    const properties = node["properties"];
    const [step, ...rest] = path;
    return isNode(properties) && step !== undefined && reaches(root, properties[step], rest);
}

/** 그 경로의 칸에만 주어진 값을 싣고 나머지는 계약이 받아들이는 값으로 채우며, 배열을 지나는 자리는 걸음을 소비하지 않고 대안을 적은 자리는 그 경로가 닿는 가지를 고른다. */
export function buildWithValue(root: Node, raw: unknown, path: readonly string[], leaf: unknown): unknown {
    const node = deref(root, raw);
    if (!isNode(node)) return null;
    if (path.length === 0) return leaf;

    const branches = branchesOf(node);
    if (branches.length > 0 && node["type"] === undefined) {
        const taken = branches.find((branch) => reaches(root, branch, path)) ?? branches[0];
        return buildWithValue(root, taken, path, leaf);
    }
    if (node["type"] === "array") return [buildWithValue(root, node["items"], path, leaf)];
    if (node["type"] !== "object") return minimalValue(root, node);

    const properties = isNode(node["properties"]) ? node["properties"] : {};
    const base = minimalValue(root, node) as Node;
    const [step, ...rest] = path;
    if (step !== undefined) base[step] = buildWithValue(root, properties[step], rest, leaf);
    return base;
}
