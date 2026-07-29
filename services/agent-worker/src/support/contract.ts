import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/** 이 구현이 고정한 계약 저장소의 뿌리이며 명세와 어휘는 전부 이 아래에서 읽는다. */
export const CONTRACT_ROOT = path.join(REPO_ROOT, "contract");

/** 계약 뿌리를 기준으로 한 상대 경로의 JSON 파일 하나를 읽는다. */
export function readContractJson<T>(relative: string): T {
    return JSON.parse(readFileSync(path.join(CONTRACT_ROOT, relative), "utf8")) as T;
}
