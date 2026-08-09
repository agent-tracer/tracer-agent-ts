import path from "node:path";
import { LEDGER_CONTAINER_STARTUP_MS, startLedger, type StartedLedger } from "@tracer-agent/platform/testing/ledger.container.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONTRACT_ROOT } from "~agent-worker/support/contract.js";
import { CleanupSuggestionRowEntity } from "~agent-worker/config/ledger/cleanup.suggestion.entity.js";
import type { IdGeneratorPort } from "~agent-worker/support/id.generator.port.js";
import type { CleanupObservedActivityPort } from "~agent-worker/domain/cleanup/port/cleanup.observed.activity.port.js";
import { CleanupOutputAdapter } from "./cleanup.output.adapter.js";

const NOW = new Date("2026-02-01T00:00:00.000Z");
const LAST_EVENT_AT = new Date("2026-01-01T00:01:00.000Z");

/** 식별자 포트의 대역이며 순서만 보장하고 실물의 시간 정렬은 흉내 내지 않는다. */
class SequentialIds implements IdGeneratorPort {
    private position = 0;

    next(): string {
        this.position += 1;
        return `generated-${String(this.position)}`;
    }
}

/** 추적의 집합 조회 대역이며 실은 식별자를 남겨 왕복 수를 셀 수 있게 한다. */
class FakeObservedActivity implements CleanupObservedActivityPort {
    readonly calls: (readonly string[])[] = [];

    constructor(private readonly known: ReadonlyMap<string, Date>) {}

    lastEventAtByTask(_userId: string, taskIds: readonly string[]): Promise<ReadonlyMap<string, Date>> {
        this.calls.push([...taskIds]);
        return Promise.resolve(this.known);
    }
}

const clock = {
    now: () => NOW,
    nowMs: () => NOW.getTime(),
    nowIso: () => NOW.toISOString(),
};

let ledger: StartedLedger;
let observed: FakeObservedActivity;
let target: CleanupOutputAdapter;

function suggestion(taskId = "task-1", rationale = "사건이 오래 없다") {
    return { kind: "archive" as const, taskId, rationale, evidenceEventIds: ["e1"] };
}

function batch(suggestions: readonly ReturnType<typeof suggestion>[], jobId = "job-1") {
    return { userId: "local", jobId, suggestions };
}

beforeAll(async () => {
    ledger = await startLedger(path.join(CONTRACT_ROOT, "db", "migrations"), [CleanupSuggestionRowEntity]);
}, LEDGER_CONTAINER_STARTUP_MS);

afterAll(async () => {
    await ledger.stop();
});

beforeEach(async () => {
    await ledger.truncate();
    observed = new FakeObservedActivity(new Map([["task-1", LAST_EVENT_AT]]));
    target = new CleanupOutputAdapter(ledger.source, new SequentialIds(), clock, observed);
});

describe("종결 단계가 제안을 자기 원장에 적는다", () => {
    it("제안을 pending 으로 적고 대조할 값을 비운다", async () => {
        await expect(target.createSuggestions(batch([suggestion()]))).resolves.toBe(1);

        const [row] = await ledger.repository(CleanupSuggestionRowEntity).find();
        expect({
            status: row?.status,
            kind: row?.kind,
            jobId: row?.jobId,
            currentValue: row?.currentValue,
            proposedValue: row?.proposedValue,
            error: row?.error,
            resolvedAt: row?.resolvedAt,
        }).toEqual({
            status: "pending",
            kind: "archive",
            jobId: "job-1",
            currentValue: null,
            proposedValue: null,
            error: null,
            resolvedAt: null,
        });
    });

    it("추적에 물은 마지막 사건 시각을 제안에 적는다", async () => {
        await target.createSuggestions(batch([suggestion()]));

        const [row] = await ledger.repository(CleanupSuggestionRowEntity).find();
        expect(row?.observedLastEventAt).toEqual(LAST_EVENT_AT);
    });

    it("사건이 없는 태스크의 관측 시각은 비운다", async () => {
        await target.createSuggestions(batch([suggestion("task-사건없음")]));

        const [row] = await ledger.repository(CleanupSuggestionRowEntity).find();
        expect(row?.observedLastEventAt).toBeNull();
    });

    it("제안이 여럿이어도 마지막 사건 시각을 한 번에 묻는다", async () => {
        await target.createSuggestions(batch([suggestion("task-1"), suggestion("task-2")]));

        expect(observed.calls).toEqual([["task-1", "task-2"]]);
    });

    it("같은 태스크와 종류에 대기 행이 있으면 그 행을 고치고 새로 만들지 않는다", async () => {
        await target.createSuggestions(batch([suggestion()]));

        await target.createSuggestions(batch([suggestion("task-1", "다시 본 근거")], "job-2"));

        const rows = await ledger.repository(CleanupSuggestionRowEntity).find();
        expect(rows).toHaveLength(1);
        expect({ rationale: rows[0]?.rationale, jobId: rows[0]?.jobId }).toEqual({
            rationale: "다시 본 근거",
            jobId: "job-2",
        });
    });

    it("앞의 제안이 해소되었으면 같은 태스크에 새 대기 행을 만든다", async () => {
        await target.createSuggestions(batch([suggestion()]));
        await ledger.repository(CleanupSuggestionRowEntity).update({ status: "pending" }, { status: "dismissed" });

        await target.createSuggestions(batch([suggestion()], "job-2"));

        await expect(ledger.repository(CleanupSuggestionRowEntity).count()).resolves.toBe(2);
    });

    it("적을 제안이 없으면 추적을 부르지도 원장을 건드리지도 않는다", async () => {
        await expect(target.createSuggestions(batch([]))).resolves.toBe(0);
        expect(observed.calls).toEqual([]);
        await expect(ledger.repository(CleanupSuggestionRowEntity).count()).resolves.toBe(0);
    });

    it("모델이 흘린 자격 증명을 원장에 적기 전에 가린다", async () => {
        await target.createSuggestions(batch([suggestion("task-1", "키는 sk-ant-AAAAAAAAAAAAAAAA 이다")]));

        const [row] = await ledger.repository(CleanupSuggestionRowEntity).find();
        expect(row?.rationale).not.toContain("sk-ant-AAAAAAAAAAAAAAAA");
    });
});
