import { describe, expect, it } from "vitest";
import { featureLimits } from "@tracer-agent/llm";
import {
    JOB_EXECUTOR,
    JOB_FEATURE_BY_KIND,
    JOB_KINDS,
    WORKFLOW_JOB_KINDS,
} from "~agent-api/domain/job/model/job.const.js";
import { readContractJson } from "~agent-api/support/contract.js";

interface JobKindDeclaration {
    readonly agent: string;
    readonly executor: string;
    readonly deadlineMs?: number;
}

const { kinds } = readContractJson<{ readonly kinds: Readonly<Record<string, JobKindDeclaration>> }>(
    "wire/job.kinds.json",
);

describe("잡 실행 데드라인", () => {
    it("워크플로가 태우는 종류마다 계약이 적은 데드라인을 카탈로그가 갖는다", () => {
        for (const kind of WORKFLOW_JOB_KINDS) {
            expect(featureLimits(JOB_FEATURE_BY_KIND[kind]).deadlineMs).toBe(kinds[kind]?.deadlineMs);
        }
    });

    it("로컬 실행기가 가져가는 종류는 계약도 데드라인을 적지 않는다", () => {
        for (const kind of JOB_KINDS) {
            if (JOB_EXECUTOR[kind] !== "local") continue;
            expect(kinds[kind]?.deadlineMs).toBeUndefined();
        }
    });

    it("실행 주체를 계약과 같게 안다", () => {
        for (const kind of JOB_KINDS) expect(JOB_EXECUTOR[kind]).toBe(kinds[kind]?.executor);
    });
});
