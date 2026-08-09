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
    // 종류마다 반복하는 검사는 이 축이 더 든 종류만 잡으므로 계약이 적은 종류의 수까지 함께 센다.
    it("계약이 적은 종류를 그대로 갖는다", () => {
        expect([...JOB_KINDS].sort()).toEqual(Object.keys(kinds).sort());
    });

    it("종류마다 계약이 적은 에이전트 이름을 기능 이름으로 쓴다", () => {
        for (const kind of WORKFLOW_JOB_KINDS) expect(JOB_FEATURE_BY_KIND[kind]).toBe(kinds[kind]?.agent);
    });

    it("워크플로가 태우는 종류마다 계약이 적은 데드라인을 카탈로그가 갖는다", () => {
        for (const kind of WORKFLOW_JOB_KINDS) {
            expect(featureLimits(JOB_FEATURE_BY_KIND[kind]).deadlineMs).toBe(kinds[kind]?.deadlineMs);
        }
    });

    it("실행 주체를 계약과 같게 안다", () => {
        for (const kind of JOB_KINDS) expect(JOB_EXECUTOR[kind]).toBe(kinds[kind]?.executor);
    });
});
