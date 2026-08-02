import { metrics } from "@opentelemetry/api";
import { readContractYaml } from "~agent-worker/support/contract.js";

interface ExecutionMetricsDeclaration {
    readonly executionMetrics: {
        readonly instruments: readonly { readonly name: string; readonly unit: string }[];
    };
}

const declared = readContractYaml<ExecutionMetricsDeclaration>("workflow/metrics.yaml").executionMetrics;

/** 계약이 이름을 소유하므로 그 목록에 없는 지표는 세울 수 없다. */
function instrument(name: string): { readonly name: string; readonly unit: string } {
    const found = declared.instruments.find((one: { readonly name: string; readonly unit: string }) => one.name === name);
    if (found === undefined) throw new Error(`metrics.instrument-missing:${name}`);
    return found;
}

const EXHAUSTION = instrument("agent.probe.budget.exhaustion_ratio");
const REDISPATCH = instrument("agent.redispatch.rounds");
const VALIDATION = instrument("agent.validation.failure");
const LANDED = instrument("agent.model.landed");

const meter = metrics.getMeter("tracer-agent.execution");

const exhaustionRatio = meter.createHistogram(EXHAUSTION.name, { unit: EXHAUSTION.unit });
const redispatchRounds = meter.createHistogram(REDISPATCH.name, { unit: REDISPATCH.unit });
const validationFailure = meter.createCounter(VALIDATION.name, { unit: VALIDATION.unit });
const modelLanded = meter.createCounter(LANDED.name, { unit: LANDED.unit });

/** 전문가 하나가 배분받은 몫 가운데 실제로 쓴 비율이며 1 에 가까울수록 그 축의 몫이 모자랐다. */
export function recordProbeExhaustion(
    agent: string,
    probe: string,
    spentUsd: number | null,
    grantedUsd: number | undefined,
): void {
    if (spentUsd === null || grantedUsd === undefined || grantedUsd <= 0) return;
    exhaustionRatio.record(Math.min(spentUsd / grantedUsd, 1), { agent, probe });
}

/** 조율자가 종합 대신 전문가를 다시 부른 라운드 수다. */
export function recordRedispatchRounds(agent: string, rounds: number): void {
    redispatchRounds.record(rounds, { agent });
}

/** 결정론 검증이 산출을 거절한 실행이며 repaired 가 그 뒤 수리가 살렸는지를 가른다. */
export function recordValidationFailure(agent: string, repaired: boolean): void {
    validationFailure.add(1, { agent, repaired });
}

/** 예산이 다해 도구를 거두고 결론만 받은 실행이다. */
export function recordModelLanded(agent: string): void {
    modelLanded.add(1, { agent });
}
