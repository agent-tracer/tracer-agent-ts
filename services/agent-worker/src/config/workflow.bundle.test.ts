import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bundleWorkflows, WORKFLOW_ENTRIES, workflowEntryPath } from "./workflow.bundle.js";

/** webpack 이 그래프를 전부 읽으므로 기본 상한보다 길게 준다. */
const BUNDLE_TIMEOUT_MS = 180_000;

const SOURCE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 진입점 파일은 워크플로 번들에만 쓰이므로 이름으로 셀 수 있다. */
function entryFilesOnDisk(): string[] {
    return readdirSync(SOURCE_ROOT)
        .filter((name) => name === "workflows.ts" || name.endsWith(".workflows.ts"))
        .sort();
}

describe("워크플로 번들", () => {
    it("선언한 진입점이 디스크의 진입점 파일과 같은 수다", () => {
        expect(WORKFLOW_ENTRIES.map((entry) => `${entry}.ts`).sort()).toEqual(entryFilesOnDisk());
    });

    it.each(WORKFLOW_ENTRIES)("%s 진입점이 가리키는 파일이 실재한다", (entry) => {
        expect(entryFilesOnDisk()).toContain(path.basename(workflowEntryPath(entry)));
    });

    it.each(WORKFLOW_ENTRIES)(
        "%s 진입점이 결정적 샌드박스에 실을 번들로 만들어진다",
        async (entry) => {
            const bundle = await bundleWorkflows(entry);

            expect(bundle.code.length).toBeGreaterThan(0);
        },
        BUNDLE_TIMEOUT_MS,
    );
});
