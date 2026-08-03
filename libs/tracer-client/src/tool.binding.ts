import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CONTRACT_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../contract",
);

/** 도구 하나가 되읽거나 부르는 추적 API 한 자리이며 인자가 경로·쿼리·본문 중 어디로 가는지를 담는다. */
export interface ToolBinding {
    readonly method: string;
    readonly path: string;
    readonly pathArgs: readonly string[];
    readonly query: Readonly<Record<string, string>>;
    readonly body: Readonly<Record<string, string>>;
    readonly bodyConstants: Readonly<Record<string, string>>;
}

interface ChatBindingSection {
    readonly bindings: Readonly<Record<string, ToolBinding>>;
    readonly actionBindings: Readonly<Record<string, Readonly<Record<string, ToolBinding>>>>;
}

interface ChatToolFile {
    readonly bindings: ChatBindingSection;
}

function readSection(): ChatBindingSection {
    const declared = JSON.parse(
        readFileSync(path.join(CONTRACT_ROOT, "agent/chat/tool.json"), "utf8"),
    ) as ChatToolFile;
    return declared.bindings;
}

const SECTION = readSection();

/** 도구 이름을 그 도구가 부르는 추적 API 한 자리에 잇는 표이며 값은 계약이 소유한다. */
export const TOOL_BINDINGS: Readonly<Record<string, ToolBinding>> = SECTION.bindings;

/** action 을 받는 도구가 그 action 마다 갖는 자리이며 값은 계약이 소유한다. */
export const TOOL_ACTION_BINDINGS: Readonly<
    Record<string, Readonly<Record<string, ToolBinding>>>
> = SECTION.actionBindings;

/** 이 도구가 action 으로 자리를 가르는지 알린다. */
export function takesAction(toolName: string): boolean {
    return TOOL_ACTION_BINDINGS[toolName] !== undefined;
}

/** 도구 이름과 인자에 맞는 자리를 내며 계약에 없는 이름이나 action 이면 거절한다. */
export function toolBinding(
    toolName: string,
    args: Readonly<Record<string, unknown>> = {},
): ToolBinding {
    const actions = TOOL_ACTION_BINDINGS[toolName];
    if (actions !== undefined) {
        const action = args["action"];
        if (typeof action !== "string") throw new Error(`${toolName} needs an action`);
        const chosen = actions[action];
        if (chosen === undefined) throw new Error(`${toolName} has no ${action} action`);
        return chosen;
    }
    const binding = TOOL_BINDINGS[toolName];
    if (binding === undefined) throw new Error(`${toolName} is not a contract tool`);
    return binding;
}

/** 이 도구의 호출이 어느 상류로 나가는지만 보는 자리이며 action 사이에서 상류는 갈리지 않는다. */
export function toolUpstreamPath(toolName: string): string {
    const actions = TOOL_ACTION_BINDINGS[toolName];
    if (actions === undefined) return toolBinding(toolName).path;
    const [first] = Object.values(actions);
    if (first === undefined) throw new Error(`${toolName} declares no action`);
    return first.path;
}

/** 경로와 쿼리에 실리는 인자는 스칼라뿐이며 그 밖의 값은 실을 자리가 없다. */
function scalarText(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return null;
}

/** 경로 틀의 자리를 도구 인자 값으로 채운다. */
export function fillPath(binding: ToolBinding, args: Readonly<Record<string, unknown>>): string {
    let filled = binding.path;
    for (const name of binding.pathArgs) {
        filled = filled.replace(`{${name}}`, encodeURIComponent(scalarText(args[name]) ?? ""));
    }
    return filled;
}

/** 도구 인자에서 쿼리 이름으로 옮긴 값이며 주어지지 않은 인자는 싣지 않는다. */
export function fillQuery(
    binding: ToolBinding,
    args: Readonly<Record<string, unknown>>,
): Readonly<Record<string, string>> {
    const query: Record<string, string> = {};
    for (const [arg, wire] of Object.entries(binding.query)) {
        const value = scalarText(args[arg]);
        if (value !== null) query[wire] = value;
    }
    return query;
}

/** 도구 인자와 실행이 고정한 상수를 합친 요청 본문이며 주어지지 않은 인자는 싣지 않는다. */
export function fillBody(
    binding: ToolBinding,
    args: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | null {
    const body: Record<string, unknown> = { ...binding.bodyConstants };
    for (const [arg, wire] of Object.entries(binding.body)) {
        const value = args[arg];
        if (value !== undefined && value !== null) body[wire] = value;
    }
    return Object.keys(body).length > 0 ? body : null;
}
