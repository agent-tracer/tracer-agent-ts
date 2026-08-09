import { describe, expect, it } from "vitest";
import { readContractJson } from "~agent-worker/support/contract.js";
import {
    JOB_EXECUTOR,
    JOB_KIND,
    JOB_STATUS,
    isCancelableJobStatus,
    isTerminalJobStatus,
} from "./job.const.js";

interface JobKindDeclaration {
    readonly executor: string;
}

interface JobVocabulary {
    readonly kinds: Readonly<Record<string, JobKindDeclaration>>;
    readonly statuses: {
        readonly values: readonly string[];
        readonly terminal: readonly string[];
        readonly cancelable: readonly string[];
    };
}

const DECLARED = readContractJson<JobVocabulary>("wire/job.kinds.json");

const KINDS = Object.values(JOB_KIND);
const STATUSES = Object.values(JOB_STATUS);

function sorted(values: readonly string[]): string[] {
    return [...values].sort();
}

describe("워커가 아는 잡 어휘", () => {
    // 워커는 접수와 떨어져 있어 잡 어휘를 따로 선언하므로 계약이 적은 종류의 수까지 함께 센다.
    it("계약이 적은 종류를 그대로 갖는다", () => {
        expect(sorted(KINDS)).toEqual(sorted(Object.keys(DECLARED.kinds)));
    });

    it.each(KINDS)("%s 의 실행 주체를 계약과 같게 안다", (kind) => {
        expect(JOB_EXECUTOR[kind]).toBe(DECLARED.kinds[kind]?.executor);
    });

    it("계약이 적은 상태를 그대로 갖는다", () => {
        expect(sorted(STATUSES)).toEqual(sorted(DECLARED.statuses.values));
    });

    it("계약이 종료로 적은 상태만 종료로 본다", () => {
        expect(sorted(STATUSES.filter(isTerminalJobStatus))).toEqual(sorted(DECLARED.statuses.terminal));
    });

    it("계약이 취소할 수 있다고 적은 상태만 취소할 수 있다고 본다", () => {
        expect(sorted(STATUSES.filter(isCancelableJobStatus))).toEqual(sorted(DECLARED.statuses.cancelable));
    });
});
