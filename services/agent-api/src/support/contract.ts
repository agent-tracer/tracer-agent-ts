import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

/** 계약이 선언한 스키마 파일을 이름 순서대로 낸다. */
export function listContractSchemaFiles(): readonly string[] {
    const directory = path.join(CONTRACT_ROOT, "db", "migrations");
    return readdirSync(directory).filter((entry) => entry.endsWith(".sql")).sort();
}

/** 계약이 선언한 스키마 파일 하나의 SQL을 읽는다. */
export function readContractSchemaFile(name: string): string {
    return readFileSync(path.join(CONTRACT_ROOT, "db", "migrations", name), "utf8");
}
