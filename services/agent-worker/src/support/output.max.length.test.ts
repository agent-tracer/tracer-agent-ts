import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";
import { cleanupSuggestionsListSchema } from "~agent-worker/domain/cleanup/model/cleanup.suggestion.schema.js";
import { recipeCandidatesListSchema } from "~agent-worker/domain/recipe/model/recipe.scan.schema.js";
import { titleSuggestionsListSchema } from "~agent-worker/domain/title/model/title.suggestion.schema.js";
import { readAgentOutput } from "~agent-worker/support/contract.js";
import { branchesOf, buildWithValue, deref, stringSitesOf } from "~agent-worker/support/output.string.site.js";

type Node = Record<string, unknown>;

const AGENTS: readonly { readonly id: string; readonly schema: ZodType }[] = [
    { id: "recipe-scan", schema: recipeCandidatesListSchema },
    { id: "task-cleanup", schema: cleanupSuggestionsListSchema },
    { id: "title-suggestion", schema: titleSuggestionsListSchema },
];

function isNode(value: unknown): value is Node {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** 글자 상한만큼의 글이며 세는 단위는 계약이 코드포인트로 정했다. */
function text(length: number): string {
    return "가".repeat(length);
}

const CASES = AGENTS.flatMap(({ id, schema }) => {
    const declared = readAgentOutput(id).schema as Node;
    return stringSitesOf(declared)
        .filter((site): site is typeof site & { maxLength: number } => site.maxLength !== undefined)
        .map((site) => {
            const load = (length: number): unknown => (site.inArray ? [text(length)] : text(length));
            return {
                id,
                field: site.path.join("."),
                max: site.maxLength,
                schema,
                atLimit: buildWithValue(declared, declared, site.path, load(site.maxLength)),
                overLimit: buildWithValue(declared, declared, site.path, load(site.maxLength + 1)),
            };
        });
});

/** 위 순회기와 다른 길로 같은 제약의 수만 세며, 경로를 만들지도 방문을 억제하지도 않으므로 그 두 자리가 자리를 삼키면 두 수가 갈린다. */
function declaredCount(root: Node, raw: unknown, depth = 0): number {
    const node = deref(root, raw);
    if (!isNode(node) || depth > 40) return 0;
    let found = typeof node["maxLength"] === "number" ? 1 : 0;
    for (const branch of branchesOf(node)) found += declaredCount(root, branch, depth + 1);
    if (node["type"] === "array") found += declaredCount(root, node["items"], depth + 1);
    const properties = node["properties"];
    if (isNode(properties)) {
        for (const child of Object.values(properties)) found += declaredCount(root, child, depth + 1);
    }
    return found;
}

describe("계약이 문자열 칸에 건 글자 상한", () => {
    it("계약이 그 상한을 적어도 하나 갖는다", () => {
        expect(CASES.length).toBeGreaterThan(0);
    });

    // 검사가 조용히 적게 보는 것은 통과와 구분되지 않으므로 본 개수를 계약이 적은 수와 맞춘다.
    it.each(AGENTS)("$id 가 적은 상한을 하나도 빠뜨리지 않고 본다", ({ id }) => {
        const declared = readAgentOutput(id).schema as Node;

        expect(CASES.filter((entry) => entry.id === id).length).toBe(declaredCount(declared, declared));
    });

    // 상한만큼의 글이 통과해야 아래 거절이 한 글자 넘긴 것 때문임이 정해진다.
    it.each(CASES)("$id 의 $field 는 $max 글자를 통과시킨다", ({ schema, atLimit }) => {
        expect(schema.safeParse(atLimit).success).toBe(true);
    });

    it.each(CASES)("$id 의 $field 는 $max 글자를 한 글자 넘기면 거절한다", ({ schema, overLimit }) => {
        expect(schema.safeParse(overLimit).success).toBe(false);
    });
});
