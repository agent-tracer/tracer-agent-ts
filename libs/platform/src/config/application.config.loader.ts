import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { mergeApplicationConfig } from "./application.config.merge.js";
import type { ApplicationConfig } from "./application.config.schema.js";

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "../../../..");
const APPLICATION_YAML_PATH = path.join(REPO_ROOT, "application.yaml");
const APPLICATION_LOCAL_YAML_PATH = path.join(REPO_ROOT, "application.local.yaml");

function readYaml(filePath: string): Record<string, unknown> {
    if (!fs.existsSync(filePath)) return {};
    const parsed: unknown = parse(fs.readFileSync(filePath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
}

let cached: ApplicationConfig | null = null;

/** 기본 YAML, 로컬 YAML, 환경변수를 차례로 병합하고 검증한 애플리케이션 설정을 반환한다. */
export function loadApplicationConfig(): ApplicationConfig {
    if (cached) return cached;

    cached = mergeApplicationConfig(
        readYaml(APPLICATION_YAML_PATH),
        readYaml(APPLICATION_LOCAL_YAML_PATH),
        process.env,
    );
    return cached;
}
