import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHAT_TOOL_CONTRACT } from "~agent-worker/domain/chat/model/chat.tool.schema.js";
import { CHAT_ACTIVITY_LIMITS } from "~agent-worker/domain/chat/model/chat.workflow.spec.js";

const README = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "README.md"),
    "utf8",
);

const SURFACE_ROWS: Readonly<Record<string, string>> = {
    "읽기 도구": "read",
    "Agent read": "agentRead",
    memory: "memory",
    "확인 쓰기": "confirm",
};

function toolsOnSurface(surface: string): readonly string[] {
    return Object.entries(CHAT_TOOL_CONTRACT.tools)
        .filter(([, tool]) => tool.surface === surface)
        .map(([name]) => name);
}

/** 표의 한 행에서 수량과 예시로 든 도구 이름을 읽는다. */
function row(label: string): { count: number; examples: readonly string[] } {
    const found = new RegExp(`^\\| ${label} \\| (\\d+) \\| (.+?) \\|`, "mu").exec(README);
    if (found === null) throw new Error(`README 에 ${label} 행이 없다`);
    return {
        count: Number(found[1]),
        examples: [...(found[2] ?? "").matchAll(/`([^`]+)`/gu)].map((match) => match[1] ?? ""),
    };
}

describe("문서가 적은 도구 표", () => {
    it("계약이 가진 도구 수를 적는다", () => {
        const declared = /Chat 계약에는 (\d+)개 도구가 정의되어 있다/u.exec(README);

        expect(Number(declared?.[1])).toBe(Object.keys(CHAT_TOOL_CONTRACT.tools).length);
    });

    it.each(Object.entries(SURFACE_ROWS))("%s 행의 수량이 계약과 같다", (label, surface) => {
        expect(row(label).count).toBe(toolsOnSurface(surface).length);
    });

    it.each(Object.entries(SURFACE_ROWS))("%s 행이 실재하는 도구만 예시로 든다", (label, surface) => {
        const declared = new Set(toolsOnSurface(surface));

        for (const example of row(label).examples) expect(declared).toContain(example);
    });
});

/** 문서는 사람이 읽는 단위로 적으므로 코드가 쓰는 표기를 그 단위로 옮겨 비교한다. */
function asKorean(duration: string): string {
    const found = /^(\d+) (minutes?|seconds?)$/u.exec(duration);
    if (found === null) throw new Error(`읽을 수 없는 상한이다 — ${duration}`);
    return `${found[1]}${found[2]?.startsWith("minute") === true ? "분" : "초"}`;
}

/** 액티비티 표의 한 행에서 상한과 시도 수를 읽는다. */
function activityRow(name: string): { startToClose: string; attempts: string } {
    const found = new RegExp(`^\\| \`${name}\` \\| ([^|]+?) \\| ([^|]+?) \\|`, "mu").exec(README);
    if (found === null) throw new Error(`README 에 ${name} 행이 없다`);
    return { startToClose: (found[1] ?? "").trim(), attempts: (found[2] ?? "").trim() };
}

describe("문서가 적은 액티비티 표", () => {
    it.each(Object.keys(CHAT_ACTIVITY_LIMITS))("%s 의 상한이 코드와 같다", (name) => {
        const declared = CHAT_ACTIVITY_LIMITS[name as keyof typeof CHAT_ACTIVITY_LIMITS];

        expect(activityRow(name).startToClose).toBe(asKorean(declared.startToClose));
    });

    it.each(Object.keys(CHAT_ACTIVITY_LIMITS))("%s 의 시도 수가 코드와 같다", (name) => {
        const declared = CHAT_ACTIVITY_LIMITS[name as keyof typeof CHAT_ACTIVITY_LIMITS];
        // 생성만 시도 수를 상수로 두고 문서도 그 이름을 적으므로 이름으로 갈래를 구분한다.
        const expected = name === "generateChatExecution"
            ? "`CHAT_GENERATE_MAX_ATTEMPTS`"
            : String(declared.maximumAttempts);

        expect(activityRow(name).attempts).toBe(expected);
    });

    it("생성 액티비티의 heartbeat 를 적는다", () => {
        expect(README).toContain(asKorean(CHAT_ACTIVITY_LIMITS.generateChatExecution.heartbeat));
    });
});
