import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { JOB_GENERATE_LIMITS } from "./job.workflow.spec.js";

const DOMAIN_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "domain");

/** 잡 종류와 그 실행 구조를 설명하는 문서다. */
const DOCUMENTS: Readonly<Record<keyof typeof JOB_GENERATE_LIMITS, string>> = {
    recipeScan: "recipe",
    taskCleanup: "cleanup",
    titleSuggestion: "title",
};

function readmeOf(domain: string): string {
    return readFileSync(path.join(DOMAIN_ROOT, domain, "README.md"), "utf8");
}

/** 문서는 사람이 읽는 단위로 적으므로 코드가 쓰는 표기를 그 단위로 옮겨 비교한다. */
function asKorean(duration: string): string {
    const found = /^(\d+) (minutes?|seconds?|hours?)$/u.exec(duration);
    if (found === null) throw new Error(`읽을 수 없는 상한이다 — ${duration}`);
    const unit = found[2] ?? "";
    if (unit.startsWith("minute")) return `${found[1]}분`;
    if (unit.startsWith("second")) return `${found[1]}초`;
    return `${found[1]}시간`;
}

const CASES = Object.entries(DOCUMENTS).map(([kind, domain]) => ({
    kind,
    domain,
    limits: JOB_GENERATE_LIMITS[kind as keyof typeof JOB_GENERATE_LIMITS],
}));

describe("잡 문서가 적은 생성 활동의 상한", () => {
    it.each(CASES)("$domain 문서가 start-to-close 를 코드와 같이 적는다", ({ domain, limits }) => {
        expect(readmeOf(domain)).toContain(`${asKorean(limits.startToClose)} start-to-close`);
    });

    it.each(CASES)("$domain 문서가 schedule-to-close 를 코드와 같이 적는다", ({ domain, limits }) => {
        expect(readmeOf(domain)).toContain(`${asKorean(limits.scheduleToClose)} schedule-to-close`);
    });

    it.each(CASES)("$domain 문서가 heartbeat 를 코드와 같이 적는다", ({ domain, limits }) => {
        expect(readmeOf(domain)).toContain(`${asKorean(limits.heartbeat)} heartbeat`);
    });

    it.each(CASES)("$domain 문서가 시도 수를 코드와 같이 적는다", ({ domain, limits }) => {
        expect(readmeOf(domain)).toContain(`최대 ${limits.maximumAttempts}회 재시도`);
    });
});
