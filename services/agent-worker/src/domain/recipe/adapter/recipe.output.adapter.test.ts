import { TracerApiWindow, type HttpRequestInit } from "@tracer-agent/tracer-client";
import { describe, expect, it } from "vitest";
import { readTracerOutputsCase } from "~agent-worker/support/contract.js";
import { OUTPUT_LANGUAGE } from "~agent-worker/support/output.language.js";
import type { GeneratedRecipeCandidate } from "~agent-worker/domain/recipe/model/recipe.candidate.model.js";
import { RecipeOutputAdapter } from "./recipe.output.adapter.js";

const outputs = readTracerOutputsCase();
const window = outputs.windows.find((entry) => entry.path === "/api/v1/recipes")!;

interface Sent {
    readonly url: string;
    readonly init: HttpRequestInit;
}

function adapterWith(payload: unknown): { target: RecipeOutputAdapter; sent: Sent[] } {
    const sent: Sent[] = [];
    const tracer = new TracerApiWindow("http://tracer-api:3902", (url, init) => {
        sent.push({ url, init });
        return Promise.resolve({ status: 201, text: () => Promise.resolve(JSON.stringify(payload)) });
    });
    return { target: new RecipeOutputAdapter(tracer), sent };
}

function candidate(): GeneratedRecipeCandidate {
    return {
        title: "빌드 실패를 되돌린다",
        intent: "빌드를 되살린다",
        description: "설명",
        summaryMd: "요약",
        request: "요청",
        rationale: "근거",
        corrections: [],
        pitfalls: [],
        governingRules: [],
        steps: [],
        touchedFiles: [],
        contributingSlices: [{ taskId: "t1", turnIds: ["turn-1"], eventIds: ["evt-1"] }],
        parentRecipeId: "recipe-old",
        parentRecipeSeenRev: 2,
    };
}

function sentBody(sent: readonly Sent[]): Record<string, unknown> {
    return JSON.parse(sent[0]!.init.body!) as Record<string, unknown>;
}

describe("RecipeOutputAdapter", () => {
    it("계약이 적은 창구로 후보 한 벌을 보낸다", async () => {
        const { target, sent } = adapterWith({ ok: true, data: { recipes: [{ id: "r1" }] } });

        const created = await target.createCandidates({
            userId: "local",
            language: OUTPUT_LANGUAGE.ko,
            sourceJobId: "job-1",
            recipes: [candidate()],
        });

        expect(sent[0]!.url).toBe(`http://tracer-api:3902${window.path}`);
        expect(sent[0]!.init.method).toBe(window.method);
        expect(created).toBe(1);
    });

    it("본문의 칸이 계약이 적은 목록 안에 있다", async () => {
        const { target, sent } = adapterWith({ ok: true, data: { recipes: [{ id: "r1" }] } });

        await target.createCandidates({
            userId: "local",
            language: OUTPUT_LANGUAGE.ko,
            sourceJobId: "job-1",
            recipes: [candidate()],
        });

        const body = sentBody(sent);
        const allowed = [...window.body.required, ...window.body.optional];
        expect(Object.keys(body).every((field) => allowed.includes(field))).toBe(true);
        expect(window.body.required.every((field) => Object.hasOwn(body, field))).toBe(true);
    });

    it("후보 한 건의 칸이 계약이 적은 초안의 칸 안에 있다", async () => {
        const { target, sent } = adapterWith({ ok: true, data: { recipes: [{ id: "r1" }] } });

        await target.createCandidates({
            userId: "local",
            language: OUTPUT_LANGUAGE.ko,
            sourceJobId: "job-1",
            recipes: [candidate()],
        });

        const draft = (sentBody(sent)["recipes"] as Record<string, unknown>[])[0]!;
        const allowed = [...outputs.drafts.recipe.required, ...outputs.drafts.recipe.optional];
        expect(Object.keys(draft).every((field) => allowed.includes(field))).toBe(true);
        expect(outputs.drafts.recipe.required.every((field) => Object.hasOwn(draft, field))).toBe(true);
    });

    it("계약이 못박은 멱등키를 실어 같은 실행이 후보를 두 벌 만들지 않게 한다", async () => {
        const { target, sent } = adapterWith({ ok: true, data: { recipes: [] } });

        await target.createCandidates({
            userId: "local",
            language: OUTPUT_LANGUAGE.ko,
            sourceJobId: "job-1",
            recipes: [candidate()],
        });

        expect(sentBody(sent)[outputs.idempotency.recipes.key]).toBe("job-1");
    });

    it("보낼 후보가 없으면 창구를 부르지 않는다", async () => {
        const { target, sent } = adapterWith({ ok: true, data: { recipes: [] } });

        await expect(
            target.createCandidates({
                userId: "local",
                language: OUTPUT_LANGUAGE.ko,
                sourceJobId: "job-1",
                recipes: [],
            }),
        ).resolves.toBe(0);
        expect(sent).toEqual([]);
    });
});
