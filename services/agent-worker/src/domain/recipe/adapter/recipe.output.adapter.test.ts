import path from "node:path";
import { AGENT_BACKEND } from "@tracer-agent/llm";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONTRACT_ROOT } from "~agent-worker/support/contract.js";
import { RecipeRowEntity } from "~agent-worker/config/ledger/recipe.entity.js";
import { SearchOutboxRowEntity } from "~agent-worker/config/ledger/search.outbox.entity.js";
import { OUTPUT_LANGUAGE } from "~agent-worker/support/output.language.js";
import type { IdGeneratorPort } from "~agent-worker/support/id.generator.port.js";
import type { GeneratedRecipeCandidate } from "~agent-worker/domain/recipe/model/recipe.candidate.model.js";
import { RecipeOutputAdapter } from "./recipe.output.adapter.js";

const NOW = new Date("2026-02-01T00:00:00.000Z");

/** 식별자 포트의 대역이며 순서만 보장하고 실물의 시간 정렬은 흉내 내지 않는다. */
class SequentialIds implements IdGeneratorPort {
    private position = 0;

    next(): string {
        this.position += 1;
        return `generated-${String(this.position)}`;
    }
}

/** 시계 포트의 고정 시각 대역이다. */
const clock = {
    now: () => NOW,
    nowMs: () => NOW.getTime(),
    nowIso: () => NOW.toISOString(),
};

let ledger: StartedLedger;
let target: RecipeOutputAdapter;

function candidate(overrides: Partial<GeneratedRecipeCandidate> = {}): GeneratedRecipeCandidate {
    return {
        title: "빌드 실패를 되돌린다",
        intent: "빌드를 되살린다",
        description: "설명",
        summaryMd: "요약",
        request: "요청",
        rationale: "근거",
        useWhen: ["빌드가 타입 오류로 멈춘 뒤"],
        inputs: ["실패한 빌드 로그"],
        outputs: ["통과한 빌드"],
        corrections: [],
        pitfalls: [],
        recovery: [],
        governingRules: [],
        steps: [{ order: 1, action: "타입 오류를 읽는다", evidence: ["evt-1"] }],
        touchedFiles: [{ path: "src/a.ts", role: "write", why: null, loadWhen: null }],
        contributingSlices: [{ taskId: "t1", turnIds: ["turn-1"], eventIds: ["evt-1"] }],
        ...overrides,
    };
}

function batch(recipes: readonly GeneratedRecipeCandidate[], sourceJobId = "job-1") {
    return { userId: "local", language: OUTPUT_LANGUAGE.ko, sourceJobId, recipes };
}

/** 부모로 삼을 레시피 하나를 원장에 미리 세운다. */
async function seedParent(id: string, userId: string, rev: number): Promise<void> {
    await ledger.repository(RecipeRowEntity).insert({
        id,
        userId,
        status: "active",
        title: "부모",
        intent: "부모 의도",
        description: "부모 설명",
        useWhen: [],
        summaryMd: "부모 요약",
        request: "부모 요청",
        inputs: [],
        outputs: [],
        corrections: [],
        pitfalls: [],
        recovery: [],
        governingRules: [],
        steps: [],
        touchedFiles: [],
        contributingSlices: [],
        rationale: null,
        language: null,
        rev,
        parentRecipeId: null,
        sourceJobId: "job-0",
        userEdited: false,
        lastEditedBy: "agent",
        error: null,
        createdAt: NOW,
        updatedAt: NOW,
        resolvedAt: null,
        deletedAt: null,
    });
}

beforeAll(async () => {
    ledger = await startLedger(path.join(CONTRACT_ROOT, "db", "migrations"), [
        RecipeRowEntity,
        SearchOutboxRowEntity,
    ]);
    target = new RecipeOutputAdapter(ledger.source, new SequentialIds(), clock);
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
});

describe("종결 단계가 후보를 자기 원장에 적는다", () => {
    it("후보를 candidate 로 적고 만든 주체를 에이전트로 남긴다", async () => {
        await expect(target.createCandidates(batch([candidate()]))).resolves.toBe(1);

        const [row] = await ledger.repository(RecipeRowEntity).find();
        expect({
            status: row?.status,
            rev: row?.rev,
            userEdited: row?.userEdited,
            lastEditedBy: row?.lastEditedBy,
            sourceJobId: row?.sourceJobId,
            resolvedAt: row?.resolvedAt,
            deletedAt: row?.deletedAt,
        }).toEqual({
            status: "candidate",
            rev: 1,
            userEdited: false,
            lastEditedBy: "agent",
            sourceJobId: "job-1",
            resolvedAt: null,
            deletedAt: null,
        });
    });

    it("모델이 낸 칸을 그대로 원장에 옮긴다", async () => {
        const source = candidate();

        await target.createCandidates(batch([source]));

        const [row] = await ledger.repository(RecipeRowEntity).find();
        expect({ useWhen: row?.useWhen, steps: row?.steps, touchedFiles: row?.touchedFiles }).toEqual({
            useWhen: source.useWhen,
            steps: source.steps,
            touchedFiles: source.touchedFiles,
        });
    });

    it("레시피 쓰기와 색인 적재를 한 커밋으로 묶는다", async () => {
        await target.createCandidates(batch([candidate(), candidate({ title: "둘째" })]));

        const recipes = await ledger.repository(RecipeRowEntity).find();
        const outbox = await ledger.repository(SearchOutboxRowEntity).find();
        expect(outbox.map((row) => row.targetId).sort()).toEqual(recipes.map((row) => row.id).sort());
    });

    // 축이 없으면 상대 축의 배출기가 이 행을 가져가 지운다.
    it("적재한 행에 자기 축을 남긴다", async () => {
        await target.createCandidates(batch([candidate()]));

        const outbox = await ledger.repository(SearchOutboxRowEntity).find();
        expect(outbox.map((row) => row.backend)).toEqual([AGENT_BACKEND]);
    });

    it("같은 실행이 두 번 닿아도 후보를 두 벌 만들지 않는다", async () => {
        await target.createCandidates(batch([candidate()]));

        await expect(target.createCandidates(batch([candidate()]))).resolves.toBe(1);
        await expect(ledger.repository(RecipeRowEntity).count()).resolves.toBe(1);
    });

    it("부모의 판이 관측한 판과 같으면 판을 하나 올려 잇는다", async () => {
        await seedParent("recipe-parent", "local", 3);

        await target.createCandidates(
            batch([candidate({ parentRecipeId: "recipe-parent", parentRecipeSeenRev: 3 })]),
        );

        const child = await ledger.repository(RecipeRowEntity).findOneBy({ sourceJobId: "job-1" });
        expect({ rev: child?.rev, parentRecipeId: child?.parentRecipeId }).toEqual({
            rev: 4,
            parentRecipeId: "recipe-parent",
        });
    });

    it("부모의 판이 어긋나면 부모를 비우고 판을 1 로 적는다", async () => {
        await seedParent("recipe-parent", "local", 5);

        await target.createCandidates(
            batch([candidate({ parentRecipeId: "recipe-parent", parentRecipeSeenRev: 3 })]),
        );

        const child = await ledger.repository(RecipeRowEntity).findOneBy({ sourceJobId: "job-1" });
        expect({ rev: child?.rev, parentRecipeId: child?.parentRecipeId }).toEqual({
            rev: 1,
            parentRecipeId: null,
        });
    });

    it("부모가 남의 것이면 부모가 없는 것으로 본다", async () => {
        await seedParent("recipe-parent", "other", 3);

        await target.createCandidates(
            batch([candidate({ parentRecipeId: "recipe-parent", parentRecipeSeenRev: 3 })]),
        );

        const child = await ledger.repository(RecipeRowEntity).findOneBy({ sourceJobId: "job-1" });
        expect(child?.parentRecipeId).toBeNull();
    });

    it("적을 후보가 없으면 원장을 건드리지 않는다", async () => {
        await expect(target.createCandidates(batch([]))).resolves.toBe(0);
        await expect(ledger.repository(SearchOutboxRowEntity).count()).resolves.toBe(0);
    });

    it("모델이 흘린 자격 증명을 원장에 적기 전에 가린다", async () => {
        await target.createCandidates(batch([candidate({ summaryMd: "키는 sk-ant-AAAAAAAAAAAAAAAA 이다" })]));

        const [row] = await ledger.repository(RecipeRowEntity).find();
        expect(row?.summaryMd).not.toContain("sk-ant-AAAAAAAAAAAAAAAA");
    });
});
