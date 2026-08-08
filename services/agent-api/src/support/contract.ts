import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/** 이 구현이 고정한 계약 저장소의 뿌리이며 명세와 스키마는 전부 이 아래에서 읽는다. */
export const CONTRACT_ROOT = path.join(REPO_ROOT, "contract");

/** 이 구현이 만족한다고 선언한 계약의 판이다. */
export function readContractVersion(): string {
    return readFileSync(path.join(CONTRACT_ROOT, "VERSION"), "utf8").trim();
}

/** 계약 뿌리를 기준으로 한 상대 경로의 JSON 파일 하나를 읽는다. */
export function readContractJson<T>(relative: string): T {
    return JSON.parse(readFileSync(path.join(CONTRACT_ROOT, relative), "utf8")) as T;
}

/** 계약이 선언한 창구 하나의 칸이며 required 는 그 가운데 반드시 실리는 것이다. */
export interface ContractFields {
    readonly declared: readonly string[];
    readonly required: readonly string[];
}

interface OpenApiSchema {
    readonly required?: readonly string[];
    readonly properties?: Readonly<Record<string, unknown>>;
}

let httpSurface: { readonly components: { readonly schemas: Readonly<Record<string, OpenApiSchema>> } } | null = null;

/** 브라우저에 여는 표면을 선언한 계약 문서를 읽는다. */
function readHttpSurface() {
    httpSurface ??= parse(readFileSync(path.join(CONTRACT_ROOT, "http", "agent-api.openapi.yaml"), "utf8")) as typeof httpSurface;
    if (httpSurface === null) throw new Error("계약이 HTTP 표면을 선언하지 않는다");
    return httpSurface;
}

/** 계약이 이름으로 선언한 응답 스키마 하나의 칸과 그 가운데 필수인 것을 낸다. */
export function readContractFields(schemaName: string): ContractFields {
    const schema = readHttpSurface().components.schemas[schemaName];
    if (schema?.properties === undefined) {
        throw new Error(`계약이 ${schemaName} 스키마를 선언하지 않는다`);
    }
    return { declared: Object.keys(schema.properties), required: schema.required ?? [] };
}

/** 계약이 선언한 스키마 파일을 이름 순서대로 낸다. */
export function listContractSchemaFiles(): readonly string[] {
    const directory = path.join(CONTRACT_ROOT, "db", "migrations");
    return readdirSync(directory).filter((entry) => entry.endsWith(".sql")).sort();
}

/** 계약이 선언한 스키마 파일 하나의 SQL을 읽는다. */
export function readContractSchemaFile(name: string): string {
    return readFileSync(path.join(CONTRACT_ROOT, "db", "migrations", name), "utf8");
}

const CREATE_TABLE = /CREATE TABLE IF NOT EXISTS\s+"(\w+)"\s*\(([\s\S]*?)\n\);/g;
const COLUMN_LINE = /^\s*"(\w+)"\s+\S/;
const ADD_COLUMN = /ALTER TABLE\s+"(\w+)"\s+ADD COLUMN IF NOT EXISTS\s+"(\w+)"/g;
const DROP_COLUMN = /ALTER TABLE\s+"(\w+)"\s+DROP COLUMN IF EXISTS\s+"(\w+)"/g;
const RENAME_COLUMN = /ALTER TABLE\s+"(\w+)"\s+RENAME COLUMN\s+"(\w+)"\s+TO\s+"(\w+)"/g;

/** 계약의 마이그레이션을 파일 이름 순서대로 적용했을 때 남는 표와 칸을 낸다. */
export function readContractTables(): ReadonlyMap<string, ReadonlySet<string>> {
    const tables = new Map<string, Set<string>>();
    for (const file of listContractSchemaFiles()) {
        const sql = readContractSchemaFile(file);
        for (const [, table, body] of sql.matchAll(CREATE_TABLE)) {
            const columns = tables.get(table!) ?? new Set<string>();
            for (const line of body!.split("\n")) {
                const column = COLUMN_LINE.exec(line);
                if (column !== null) columns.add(column[1]!);
            }
            tables.set(table!, columns);
        }
        for (const [, table, column] of sql.matchAll(ADD_COLUMN)) tables.get(table!)?.add(column!);
        for (const [, table, column] of sql.matchAll(DROP_COLUMN)) tables.get(table!)?.delete(column!);
        for (const [, table, from, to] of sql.matchAll(RENAME_COLUMN)) {
            const columns = tables.get(table!);
            if (columns?.delete(from!) === true) columns.add(to!);
        }
    }
    return tables;
}

/** 실행 스냅샷 스트림이 지키는 규칙이며 resendIntervalMs 는 정본을 다시 내는 주기이고 headers 는 응답이 실어야 할 머리다. */
export interface ChatExecutionStreamRules {
    readonly resendIntervalMs: number;
    readonly headers: Readonly<Record<string, string>>;
    readonly replay: { readonly mode: string };
}

export function readChatExecutionStreamRules(): ChatExecutionStreamRules {
    return readContractJson<{ readonly stream: ChatExecutionStreamRules }>("conformance/cases/chat.query.json")
        .stream;
}

/** 원장 연결을 빌리지 못한 창구가 낼 상태와 코드와 문구를 계약이 적은 그대로 담는다. */
export interface LedgerAvailabilityRule {
    readonly status: number;
    readonly code: string;
    readonly message: string;
}

/** 고갈에 무엇을 낼지는 계약이 갖고 두 축이 같은 글자를 내야 하므로 값을 여기에 다시 적지 않는다. */
export function readLedgerAvailability(): LedgerAvailabilityRule {
    return readContractJson<LedgerAvailabilityRule>("agent/shared/ledger.availability.json");
}

/** 서비스를 넘어 오가는 알림 토픽의 이름과 봉투와 종류를 계약이 적은 그대로 담는다. */
export interface NotificationTopicDeclaration {
    readonly name: string;
    readonly key: string;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly types: {
        readonly jobUpdated: {
            readonly name: string;
            readonly payload: Readonly<Record<string, { readonly required: boolean }>>;
        };
    };
}

export function readNotificationTopic(): NotificationTopicDeclaration {
    return readContractJson<{ readonly notifications: NotificationTopicDeclaration }>("wire/topics.json")
        .notifications;
}
