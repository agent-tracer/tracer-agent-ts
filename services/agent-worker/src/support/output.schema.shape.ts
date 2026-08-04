/** 두 스키마를 비교할 때 남기는 뼈대이며 칸 이름과 반드시 실리는지와 열거값만 갖는다. */
export interface OutputSchemaShape {
    readonly always?: readonly string[];
    readonly enum?: readonly string[];
    readonly const?: string;
    readonly properties?: Readonly<Record<string, OutputSchemaShape>>;
    readonly items?: OutputSchemaShape;
    readonly anyOf?: readonly OutputSchemaShape[];
}

type Node = Record<string, unknown>;

function isNode(value: unknown): value is Node {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function texts(value: unknown): readonly string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

/** JSON Pointer 한 개를 문서 뿌리에서 따라간다. */
function follow(root: Node, pointer: string): unknown {
    return pointer
        .replace(/^#\//u, "")
        .split("/")
        .reduce<unknown>((node, step) => (isNode(node) ? node[step] : undefined), root);
}

function deref(root: Node, node: unknown): unknown {
    if (!isNode(node)) return node;
    const pointer = node["$ref"];
    return typeof pointer === "string" ? follow(root, pointer) : node;
}

function hasDefault(root: Node, schema: unknown): boolean {
    const node = deref(root, schema);
    return isNode(node) && "default" in node;
}

/** 값이 없다는 뜻의 대안은 칸의 모양을 말하지 않으므로 비교 목록에서 뺀다. */
function alternatives(root: Node, node: Node): readonly unknown[] | null {
    const declared = node["oneOf"] ?? node["anyOf"];
    if (!Array.isArray(declared)) return null;
    return (declared as readonly unknown[]).filter((entry) => {
        const resolved = deref(root, entry);
        return !(isNode(resolved) && resolved["type"] === "null");
    });
}

function shapeOf(root: Node, schema: unknown): OutputSchemaShape {
    const node = deref(root, schema);
    if (!isNode(node)) return {};
    const shape: {
        always?: readonly string[];
        enum?: readonly string[];
        const?: string;
        properties?: Record<string, OutputSchemaShape>;
        items?: OutputSchemaShape;
        anyOf?: readonly OutputSchemaShape[];
    } = {};

    const values = texts(node["enum"]);
    if (values.length > 0) shape.enum = [...values].sort();
    if (typeof node["const"] === "string") shape.const = node["const"];

    const properties = node["properties"];
    if (isNode(properties)) {
        const required = new Set(texts(node["required"]));
        const entries = Object.entries(properties).sort(([left], [right]) => (left < right ? -1 : 1));
        // 기본값을 갖는 칸은 모델이 내지 않아도 결과에 실리므로 필수 칸과 같은 자리에 선다.
        const always = entries
            .filter(([name, child]) => required.has(name) || hasDefault(root, child))
            .map(([name]) => name);
        if (always.length > 0) shape.always = always;
        shape.properties = Object.fromEntries(entries.map(([name, child]) => [name, shapeOf(root, child)]));
    }

    const items = node["items"];
    if (isNode(items)) shape.items = shapeOf(root, items);

    const branches = alternatives(root, node);
    if (branches !== null) shape.anyOf = branches.map((entry) => shapeOf(root, entry));

    return shape;
}

/** 생성기마다 다른 서술과 길이 제약을 제거하고 칸 이름과 반드시 실리는지와 열거값만 남긴다. */
export function outputSchemaShape(schema: unknown): OutputSchemaShape {
    return shapeOf(isNode(schema) ? schema : {}, schema);
}
