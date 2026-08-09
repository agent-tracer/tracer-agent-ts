import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cacheWriteTtl } from "./llm.catalog.schema.js";

/** 이 축이 5m 로 청구하는 근거는 실행기가 캐시 수명을 고를 자리를 열지 않는다는 것 하나이므로 그 자리가 열리는 날 이 검사가 깨진다. */
const SDK_TYPES = path.join(
    path.dirname(createRequire(import.meta.url).resolve("@anthropic-ai/claude-agent-sdk")),
    "sdk.d.ts",
);

/** 캐시 수명을 요청하는 이름이며 실행기의 타입 선언에 이 가운데 하나라도 생기면 전제가 바뀐 것이다. */
const TTL_SURFACE = [/\bttl\?:/u, /cache_control/u, /cacheControl/u];

describe("캐시 수명을 고를 자리가 없다는 전제", () => {
    it("실행기의 타입 선언을 읽을 수 있다", () => {
        expect(readFileSync(SDK_TYPES, "utf8").length).toBeGreaterThan(0);
    });

    it.each(TTL_SURFACE)("실행기가 %s 로 캐시 수명을 받지 않는다", (pattern) => {
        expect(readFileSync(SDK_TYPES, "utf8")).not.toMatch(pattern);
    });

    // 위가 참인 동안 이 축이 만드는 캐시 항목은 공급자 기본 수명 하나뿐이다.
    it("그러므로 이 축이 청구하는 수명은 하나다", () => {
        expect(cacheWriteTtl()).toBe("5m");
    });
});
