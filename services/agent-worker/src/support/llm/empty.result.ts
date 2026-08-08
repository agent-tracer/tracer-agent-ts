import { readContractJson } from "~agent-worker/support/contract.js";

interface EmptyResultReasonDeclaration {
    readonly orchestratorFailureDemotion: {
        readonly emptyResultReason: {
            readonly values: Readonly<Record<string, string>>;
            readonly default: string;
        };
    };
}

const declared = readContractJson<EmptyResultReasonDeclaration>(
    "agent/shared/execution.budget.json",
).orchestratorFailureDemotion.emptyResultReason;

/** 계약이 어휘를 소유하므로 그 목록에 없는 사유는 궤적에 적을 수 없다. */
function reasonValue(name: string): string {
    if (declared.values[name] === undefined) {
        throw new Error(`execution.budget.emptyResultReason-missing:${name}`);
    }
    return name;
}

/**
 * 빈 결과로 끝난 실행이 왜 비었는지를 적는 어휘이며 값은 계약의
 * `agent/shared/execution.budget.json`의 `orchestratorFailureDemotion.emptyResultReason`이 소유한다.
 */
export const EMPTY_RESULT_REASON = {
    /** 조사 계획이 비었거나 후보가 만들어지지 않았고 실행 자체는 정상이었다. */
    noPattern: reasonValue("no-pattern"),
    /** 조사를 실행했으나 근거가 모자라 후보를 세울 수 없었다. */
    insufficientEvidence: reasonValue("insufficient-evidence"),
    /** 계획·조사·검증·전달 가운데 한 단계가 실패해 산출을 빈 결과로 낮췄다. */
    generationDegraded: reasonValue("generation-degraded"),
} as const;

export type EmptyResultReason = (typeof EMPTY_RESULT_REASON)[keyof typeof EMPTY_RESULT_REASON];

/** 빈 결과의 사유를 남기는 자리이며 어느 단계에서 비었든 이 한 이름으로 궤적에 선다. */
export const EMPTY_RESULT_NODE = "empty_result";

/** 궤적 한 줄에 담기는 글자이며 두 축이 같은 글자를 내야 원장에서 사유가 대조된다. */
export function renderEmptyResultReason(reason: EmptyResultReason): string {
    return `empty result: ${reason}`;
}
