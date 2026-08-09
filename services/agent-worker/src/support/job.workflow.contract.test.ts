import { describe, expect, it } from "vitest";
import { readContractYaml } from "~agent-worker/support/contract.js";
import {
    JOB_GENERATE_ACTIVITY,
    JOB_SHORT_LIMITS,
    JOB_SHORT_MAX_ATTEMPTS,
} from "./job.workflow.spec.js";

interface DeclaredActivity {
    readonly name: string;
    readonly queue: string;
    readonly startToCloseSeconds: number;
    readonly maximumAttempts: number;
}

const DECLARED = readContractYaml<{
    readonly jobWorkflows: { readonly perKind: Readonly<Record<string, { readonly activities: readonly DeclaredActivity[] }>> };
}>("workflow/queues.yaml").jobWorkflows.perKind;

const KINDS = Object.keys(JOB_SHORT_LIMITS) as (keyof typeof JOB_SHORT_LIMITS)[];

/** 코드는 사람이 읽는 표기를 쓰므로 초로 모아 비교한다. */
function seconds(duration: string): number {
    const found = /^(\d+) (minutes?|seconds?|hours?)$/u.exec(duration);
    if (found === null) throw new Error(`읽을 수 없는 상한이다 — ${duration}`);
    const unit = found[2] ?? "";
    const scale = unit.startsWith("hour") ? 3600 : unit.startsWith("minute") ? 60 : 1;
    return Number(found[1]) * scale;
}

function activitiesOf(kind: string): readonly DeclaredActivity[] {
    const declared = DECLARED[kind];
    if (declared === undefined) throw new Error(`계약이 ${kind} 을 적지 않는다`);
    return declared.activities;
}

/** 짧은 활동은 jobs 큐가 맡으며 생성만 generate 큐로 간다. */
function shortActivitiesOf(kind: string): readonly DeclaredActivity[] {
    return activitiesOf(kind).filter((activity) => activity.name !== JOB_GENERATE_ACTIVITY[kind as keyof typeof JOB_GENERATE_ACTIVITY]);
}

describe("계약이 적은 잡 워크플로의 활동 상한", () => {
    it("계약이 이 축이 아는 종류를 모두 적는다", () => {
        expect(Object.keys(DECLARED).sort()).toEqual([...KINDS].sort());
    });

    // 계약이 그 종류를 적지 않으면 파생이 조용히 이 축의 값으로 떨어지므로 그 갈래에 닿지 않는지 본다.
    it.each(KINDS)("%s 의 생성 활동을 계약이 적어 이 축의 기본값이 쓰이지 않는다", (kind) => {
        const names = activitiesOf(kind).map((activity) => activity.name);

        expect(names).toContain(JOB_GENERATE_ACTIVITY[kind]);
    });

    it.each(KINDS)("%s 의 생성 활동만 generate 큐에서 실행한다", (kind) => {
        const onGenerateQueue = activitiesOf(kind)
            .filter((activity) => activity.queue === "generate")
            .map((activity) => activity.name);

        expect(onGenerateQueue).toEqual([JOB_GENERATE_ACTIVITY[kind]]);
    });

    it.each(KINDS)("%s 의 준비 상한이 계약이 적은 값과 같다", (kind) => {
        const declared = shortActivitiesOf(kind).find((activity) => activity.name.startsWith("prepare"));

        expect(seconds(JOB_SHORT_LIMITS[kind].prepare)).toBe(declared?.startToCloseSeconds);
    });

    it.each(KINDS)("%s 의 종결 상한이 계약이 적은 값과 같다", (kind) => {
        const declared = shortActivitiesOf(kind).find((activity) => activity.name.startsWith("finalize"));

        expect(seconds(JOB_SHORT_LIMITS[kind].finalize)).toBe(declared?.startToCloseSeconds);
    });

    // 짧은 활동은 종류를 가리지 않고 같은 시도 수를 쓰므로 계약의 모든 짧은 활동이 그 수여야 한다.
    it.each(KINDS)("%s 의 짧은 활동이 모두 같은 시도 수를 쓴다", (kind) => {
        const attempts = shortActivitiesOf(kind).map((activity) => activity.maximumAttempts);

        expect([...new Set(attempts)]).toEqual([JOB_SHORT_MAX_ATTEMPTS]);
    });
});
