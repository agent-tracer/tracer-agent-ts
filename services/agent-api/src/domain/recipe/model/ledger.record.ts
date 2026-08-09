/** 추적 원장의 변경 스트림이 싣는 사건 하나이며 칸의 이름은 계약의 wire/topics.json 이 갖는다. */
export interface LedgerRecord {
    readonly id: string;
    readonly seq: string | null;
    readonly userId: string;
    readonly taskId: string;
    readonly kind: string;
    readonly occurredAt: Date;
    readonly payload: Readonly<Record<string, unknown>>;
}

/** 이 프로젝터가 고르는 사건의 종류이며 나머지는 아무것도 하지 않고 넘긴다. */
export const RECIPE_INJECTED_EVENT_KIND = "agent_tracer.recipe.injected";

function readString(value: unknown): string | null {
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    return null;
}

/** payload 는 객체이거나 JSON 문자열로 실려 올 수 있다. */
function readPayload(value: unknown): Readonly<Record<string, unknown>> {
    if (typeof value === "string") {
        try {
            const parsed: unknown = JSON.parse(value);
            return isRecord(parsed) ? parsed : {};
        } catch {
            return {};
        }
    }
    return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 사건 하나를 읽으며 식별자와 태스크와 종류와 시각이 없으면 읽지 못한 것으로 본다. */
export function parseLedgerRecord(value: unknown): LedgerRecord | null {
    if (!isRecord(value)) return null;
    const id = readString(value["id"]);
    const userId = readString(value["user_id"]);
    const taskId = readString(value["task_id"]);
    const kind = readString(value["kind"]);
    const occurredAt = readString(value["occurred_at"]);
    if (id === null || userId === null || taskId === null || kind === null || occurredAt === null) return null;
    const occurred = new Date(occurredAt);
    if (Number.isNaN(occurred.getTime())) return null;
    return {
        id,
        seq: readString(value["seq"]),
        userId,
        taskId,
        kind,
        occurredAt: occurred,
        payload: readPayload(value["payload"]),
    };
}
