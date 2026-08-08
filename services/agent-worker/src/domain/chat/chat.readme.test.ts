import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHAT_TOOL_CONTRACT } from "~agent-worker/domain/chat/model/chat.tool.schema.js";

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
