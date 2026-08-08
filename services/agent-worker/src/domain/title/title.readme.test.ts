import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
    TITLE_MAX_SUGGESTIONS,
    TITLE_MIN_SUGGESTIONS,
} from "~agent-worker/domain/title/model/title.suggestion.schema.js";

const README = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "README.md"),
    "utf8",
);

describe("문서가 적은 제안 개수", () => {
    it("계약과 검증기가 정한 범위를 그대로 적는다", () => {
        expect(README).toContain(`${TITLE_MIN_SUGGESTIONS}~${TITLE_MAX_SUGGESTIONS}개의 제목 후보`);
    });
});
