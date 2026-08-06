import { AgentExecutionFailure, type ResolvedAgentPrompt } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { OUTPUT_LANGUAGE } from "~agent-worker/support/output.language.js";
import type { RecipeCandidatePayload } from "../model/recipe.scan.schema.js";
import {
    attemptRun,
    emptyOutput,
    FakeRecipeAgent,
    fixedClock,
    recipeIds,
    seedRepository,
} from "../port/__fakes__/recipe.test-support.js";
import type { RecipeScanPrep } from "./prepare.recipe.scan.usecase.js";
import { ScanRecipeUsecase } from "./scan.recipe.usecase.js";

const PROMPT: ResolvedAgentPrompt = {
    promptVersion: "v0.0.1",
    toolContractVersion: "v0.0.1",
};

function prep(): RecipeScanPrep {
    return {
        jobId: "job-1",
        userId: "user-1",
        taskId: "task-1",
        language: OUTPUT_LANGUAGE.ko,
        prompt: PROMPT,
    };
}

function candidate(overrides: Partial<RecipeCandidatePayload> = {}): RecipeCandidatePayload {
    return {
        title: "TypeORM 변경에 복구 경로 추가",
        intent: "데이터 변경 안정성 확보",
        description: "설명",
        summary_md: "- 요약",
        request: "요청",
        use_when: [],
        inputs: [],
        outputs: [],
        corrections: [],
        pitfalls: [],
        recovery: [],
        governing_rules: [],
        steps: [],
        touched_files: [{ path: "src/a.ts", role: "write" }],
        contributing_slices: [{ taskId: "task-1", turnIds: [], eventIds: ["evt-1"] }],
        rationale: "근거",
        ...overrides,
    };
}

describe("ScanRecipeUsecase", () => {
    it("확인된 이벤트와 turn 인용만 후보에 남긴다", async () => {
        const repository = seedRepository();
        repository.ownedTaskIds.add("task-1");
        const agent = new FakeRecipeAgent(emptyOutput({
            recipes: [candidate({
                contributing_slices: [{
                    taskId: "task-1",
                    turnIds: ["turn-1", "turn-ghost"],
                    eventIds: ["evt-1", "evt-ghost"],
                }],
            })],
            provenance: {
                eventIdsByTask: { "task-1": ["evt-1"] },
                turnIdsByTask: { "task-1": ["turn-1"] },
                ruleIds: [],
                recipeRevs: {},
            },
        }));
        const target = new ScanRecipeUsecase(repository, agent, fixedClock, recipeIds());

        const output = await target.execute(prep(), attemptRun());

        expect(output.recipes[0]?.contributingSlices).toEqual([
            { taskId: "task-1", turnIds: ["turn-1"], eventIds: ["evt-1"] },
        ]);
        expect(agent.calls[0]?.apiKey).toBe("sk-test");
    });

    it("적용 조건과 입출력은 그대로 옮기고 복구와 단계의 근거는 장부로 거른다", async () => {
        const repository = seedRepository();
        repository.ownedTaskIds.add("task-1");
        const agent = new FakeRecipeAgent(emptyOutput({
            recipes: [candidate({
                use_when: ["빌드가 타입 오류로 멈춘 뒤"],
                inputs: ["실패한 빌드 로그"],
                outputs: ["통과한 빌드"],
                recovery: [
                    { symptom: "같은 오류가 남는다", action: "산출을 지운다", evidence: ["evt-1", "evt-ghost"] },
                    { symptom: "근거가 없다", action: "무시한다", evidence: ["evt-ghost"] },
                ],
                steps: [{ order: 1, action: "타입 오류를 읽는다", evidence: ["evt-1", "evt-ghost"] }],
                touched_files: [{ path: "src/a.ts", role: "write", why: "오류가 난 자리다", loadWhen: "첫 단계" }],
            })],
            provenance: {
                eventIdsByTask: { "task-1": ["evt-1"] },
                turnIdsByTask: {},
                ruleIds: [],
                recipeRevs: {},
            },
        }));
        const target = new ScanRecipeUsecase(repository, agent, fixedClock, recipeIds());

        const assembled = (await target.execute(prep(), attemptRun())).recipes[0]!;

        expect(assembled.useWhen).toEqual(["빌드가 타입 오류로 멈춘 뒤"]);
        expect(assembled.inputs).toEqual(["실패한 빌드 로그"]);
        expect(assembled.outputs).toEqual(["통과한 빌드"]);
        expect(assembled.touchedFiles).toEqual([
            { path: "src/a.ts", role: "write", why: "오류가 난 자리다", loadWhen: "첫 단계" },
        ]);
        // 근거가 하나도 남지 않은 복구는 지적과 같이 빠지고, 단계는 근거만 잃고 남는다.
        expect(assembled.recovery).toEqual([
            { symptom: "같은 오류가 남는다", action: "산출을 지운다", evidence: ["evt-1"] },
        ]);
        expect(assembled.steps).toEqual([{ order: 1, action: "타입 오류를 읽는다", evidence: ["evt-1"] }]);
    });

    it("사용자 소유가 아닌 태스크만 인용한 후보는 제외한다", async () => {
        const repository = seedRepository();
        const agent = new FakeRecipeAgent(emptyOutput({ recipes: [candidate()] }));
        const target = new ScanRecipeUsecase(repository, agent, fixedClock, recipeIds());

        const output = await target.execute(prep(), attemptRun());

        expect(output.recipes).toEqual([]);
    });

    it("서로 다른 turn을 인용한 후보를 별도 레시피로 남긴다", async () => {
        const repository = seedRepository();
        repository.ownedTaskIds.add("task-1");
        const agent = new FakeRecipeAgent(emptyOutput({
            recipes: [
                candidate({
                    title: "첫 작업",
                    contributing_slices: [{
                        taskId: "task-1",
                        turnIds: ["turn-1"],
                        eventIds: ["evt-1"],
                    }],
                }),
                candidate({
                    title: "둘째 작업",
                    contributing_slices: [{
                        taskId: "task-1",
                        turnIds: ["turn-2"],
                        eventIds: ["evt-2"],
                    }],
                }),
            ],
            provenance: {
                eventIdsByTask: { "task-1": ["evt-1", "evt-2"] },
                turnIdsByTask: { "task-1": ["turn-1", "turn-2"] },
                ruleIds: [],
                recipeRevs: {},
            },
        }));
        const target = new ScanRecipeUsecase(repository, agent, fixedClock, recipeIds());

        const output = await target.execute(prep(), attemptRun());

        expect(output.recipes.map((recipe) => recipe.title)).toEqual(["첫 작업", "둘째 작업"]);
        expect(output.recipes.every((recipe) => !Object.hasOwn(recipe, "id"))).toBe(true);
    });

    it("내용이 없는 궤적 스텝을 저장 대상에서 제외한다", async () => {
        const agent = new FakeRecipeAgent(emptyOutput({
            steps: [
                { seq: 0, role: "assistant", content: "생각", truncated: false, toolCalls: [] },
                { seq: 1, role: "assistant", content: "  ", truncated: false, toolCalls: [] },
            ],
        }));
        const target = new ScanRecipeUsecase(
            seedRepository(),
            agent,
            fixedClock,
            recipeIds(),
        );

        const output = await target.execute(prep(), attemptRun());

        expect(output.jobSteps).toHaveLength(1);
        expect(output.jobSteps[0]?.id).toBe("recipe-id-1");
    });

    it("에이전트 실패의 비용과 궤적을 남기고 오류를 다시 던진다", async () => {
        const repository = seedRepository();
        const agent = new FakeRecipeAgent(emptyOutput());
        agent.failure = new AgentExecutionFailure("recipe-scan", "AGENT_FAILED", "rate limited", {
            errorSubtype: "rate_limit_error",
            usage: {
                inputTokens: 4,
                outputTokens: 2,
                cacheReadTokens: 0,
                cacheCreationTokens: 0,
            },
            actualModel: "claude-haiku-4-5",
            durationMs: 500,
        });
        const target = new ScanRecipeUsecase(repository, agent, fixedClock, recipeIds());

        await expect(target.execute(prep(), attemptRun(2))).rejects.toThrow("rate limited");
        expect(repository.failedAttempts[0]?.record).toMatchObject({
            attempt: 2,
            status: "failed",
            subtype: "rate_limit_error",
        });
    });

    it("자격 증명이 필요 없는 실행에는 키를 넘기지 않는다", async () => {
        const agent = new FakeRecipeAgent(emptyOutput(), false);
        const target = new ScanRecipeUsecase(seedRepository(), agent, fixedClock, recipeIds());

        await target.execute(prep(), attemptRun());

        expect(agent.calls[0]?.apiKey).toBeUndefined();
    });
});
