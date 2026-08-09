import { describe, expect, it } from "vitest";
import { readContractYaml } from "~agent-worker/support/contract.js";
import {
    CHAT_ACTIVITY_LIMITS,
    CHAT_THREAD_IDLE_TIMEOUT,
    CHAT_THREAD_MAX_CHILDREN,
} from "./chat.workflow.spec.js";

/** 계약이 대화 워크플로의 활동 하나에 적은 벽시계 상한과 시도 수다. */
interface DeclaredActivity {
    readonly name: string;
    readonly startToCloseSeconds: number;
    readonly heartbeatTimeoutSeconds?: number;
    readonly maximumAttempts: number;
}

interface DeclaredWorkflow {
    readonly activities: readonly DeclaredActivity[];
    readonly idleSeconds?: number;
    readonly maxChildren?: number;
}

const DECLARED = readContractYaml<{ readonly workflows: Readonly<Record<string, DeclaredWorkflow>> }>(
    "workflow/queues.yaml",
).workflows;

/** 코드는 사람이 읽는 표기를 쓰므로 초로 모아 비교한다. */
function seconds(duration: string): number {
    const found = /^(\d+) (minutes?|seconds?|hours?)$/u.exec(duration);
    if (found === null) throw new Error(`읽을 수 없는 상한이다 — ${duration}`);
    const unit = found[2] ?? "";
    const scale = unit.startsWith("hour") ? 3600 : unit.startsWith("minute") ? 60 : 1;
    return Number(found[1]) * scale;
}

const DECLARED_ACTIVITIES = Object.values(DECLARED).flatMap((workflow) => workflow.activities);

const CASES = DECLARED_ACTIVITIES.map((declared) => ({
    name: declared.name,
    declared,
    limits: CHAT_ACTIVITY_LIMITS[declared.name as keyof typeof CHAT_ACTIVITY_LIMITS],
}));

describe("계약이 적은 대화 워크플로의 활동 상한", () => {
    // 계약이 활동을 더해도 이 축이 그 이름을 모르면 상한 없이 실행하므로 개수부터 맞춘다.
    it("계약이 적은 활동을 이 축이 하나도 빠뜨리지 않고 갖는다", () => {
        expect(DECLARED_ACTIVITIES.map((activity) => activity.name).sort())
            .toEqual(Object.keys(CHAT_ACTIVITY_LIMITS).sort());
    });

    it.each(CASES)("$name 의 start-to-close 가 계약이 적은 값과 같다", ({ declared, limits }) => {
        expect(seconds(limits.startToClose)).toBe(declared.startToCloseSeconds);
    });

    it.each(CASES)("$name 의 시도 수가 계약이 적은 값과 같다", ({ declared, limits }) => {
        expect(limits.maximumAttempts).toBe(declared.maximumAttempts);
    });

    it.each(CASES.filter((entry) => entry.declared.heartbeatTimeoutSeconds !== undefined))(
        "$name 의 heartbeat 가 계약이 적은 값과 같다",
        ({ declared, limits }) => {
            expect(seconds("heartbeat" in limits ? limits.heartbeat : "0 seconds"))
                .toBe(declared.heartbeatTimeoutSeconds);
        },
    );

    it("스레드 워크플로가 사는 시간과 자식 수가 계약이 적은 값과 같다", () => {
        const thread = DECLARED["chatThread"]!;

        expect({ idle: seconds(CHAT_THREAD_IDLE_TIMEOUT), children: CHAT_THREAD_MAX_CHILDREN })
            .toEqual({ idle: thread.idleSeconds, children: thread.maxChildren });
    });
});
