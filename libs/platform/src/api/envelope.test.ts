import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
    createApiErrorEnvelope,
    createApiSuccessEnvelope,
    isApiErrorEnvelope,
    isApiSuccessEnvelope,
} from "./envelope.js";

interface EnvelopeCases {
    readonly success: readonly { name: string; payload: unknown; envelope: unknown }[];
    readonly failure: readonly {
        name: string;
        code: string;
        message: string;
        details?: unknown;
        envelope: unknown;
    }[];
    readonly recognition: readonly { name: string; value: unknown; success: boolean; failure: boolean }[];
}

const CONTRACT_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../contract",
);

const cases = JSON.parse(
    readFileSync(path.join(CONTRACT_ROOT, "conformance/cases/envelope.json"), "utf8"),
) as EnvelopeCases;

describe("응답 봉투", () => {
    for (const example of cases.success) {
        it(`성공 봉투가 ${example.name}`, () => {
            expect(createApiSuccessEnvelope(example.payload)).toEqual(example.envelope);
        });
    }

    for (const example of cases.failure) {
        it(`오류 봉투가 ${example.name}`, () => {
            expect(createApiErrorEnvelope(example.code, example.message, example.details))
                .toEqual(example.envelope);
        });
    }

    for (const example of cases.recognition) {
        it(`${example.name}`, () => {
            expect(isApiSuccessEnvelope(example.value)).toBe(example.success);
            expect(isApiErrorEnvelope(example.value)).toBe(example.failure);
        });
    }
});
