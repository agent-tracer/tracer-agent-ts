import type { JobStepPayload, JobStepToolCall } from "~llm/model/job.step.js";

/** 도구 호출 하나를 인자까지 포함해 같은 호출인지 가리는 열쇠다. */
function callKey(call: JobStepToolCall): string {
    const args = Object.keys(call.args)
        .sort()
        .map((name) => `${name}=${JSON.stringify(call.args[name])}`)
        .join("&");
    return `${call.name}(${args})`;
}

/** 한 실행에서 같은 도구를 같은 인자로 다시 부른 횟수이며 조사가 겹쳤다는 신호다. */
export function duplicateToolCalls(steps: readonly JobStepPayload[]): number {
    const seen = new Set<string>();
    let duplicates = 0;
    for (const step of steps) {
        for (const call of step.toolCalls) {
            const key = callKey(call);
            if (seen.has(key)) duplicates += 1;
            seen.add(key);
        }
    }
    return duplicates;
}

/** 이 실행이 실제로 부른 도구 이름이다. */
export function calledToolNames(steps: readonly JobStepPayload[]): ReadonlySet<string> {
    return new Set(steps.flatMap((step) => step.toolCalls.map((call) => call.name)));
}

/** 모델이 같은 결론에 다른 순서로 닿는 것은 회귀가 아니므로 기대한 호출이 모두 나왔는지만 본다. */
export function coversExpectedCalls(
    steps: readonly JobStepPayload[],
    expected: readonly string[],
): boolean {
    const called = calledToolNames(steps);
    return expected.every((name) => called.has(name));
}

/** 기대했는데 한 번도 부르지 않은 도구다. */
export function missingToolCalls(
    steps: readonly JobStepPayload[],
    expected: readonly string[],
): readonly string[] {
    const called = calledToolNames(steps);
    return expected.filter((name) => !called.has(name));
}
