import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/** 이 구현이 고정한 계약 저장소의 뿌리이며 명세와 어휘는 전부 이 아래에서 읽는다. */
export const CONTRACT_ROOT = path.join(REPO_ROOT, "contract");

/** 계약 뿌리를 기준으로 한 상대 경로의 JSON 파일 하나를 읽는다. */
export function readContractJson<T>(relative: string): T {
    return JSON.parse(readFileSync(path.join(CONTRACT_ROOT, relative), "utf8")) as T;
}

interface HttpSurface {
    readonly components: { readonly schemas: Readonly<Record<string, { readonly enum?: readonly string[] }>> };
}

let httpSurface: HttpSurface | null = null;

/** 계약이 이름으로 선언한 열거 스키마 하나의 값을 선언된 차례로 낸다. */
export function readContractEnum(schemaName: string): readonly string[] {
    httpSurface ??= parse(
        readFileSync(path.join(CONTRACT_ROOT, "http", "agent-api.openapi.yaml"), "utf8"),
    ) as HttpSurface;
    const declared = httpSurface.components.schemas[schemaName]?.enum;
    if (declared === undefined) throw new Error(`계약이 ${schemaName} 을 열거로 선언하지 않는다`);
    return declared;
}
