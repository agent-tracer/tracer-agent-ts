import { describe, expect, it } from "vitest";
import { generateUlid } from "./ulid.js";

describe("generateUlid", () => {
    it("26자 크록포드 base32 문자열을 낸다", () => {
        expect(generateUlid(0)).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it("시각이 앞설수록 사전순으로도 앞선다", () => {
        expect(generateUlid(1_000).localeCompare(generateUlid(2_000))).toBeLessThan(0);
    });
});
