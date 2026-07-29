import type { ResolvedPromptFragment } from "@tracer-agent/llm";
import { AGENT } from "~agent-worker/support/agent.const.js";
import type { EvaluationAgentRegistry } from "~agent-worker/domain/evaluation/port/evaluation.agent.port.js";
import {
    runCleanupEvaluation,
    runRecipeEvaluation,
    runTitleEvaluation,
    type EvaluationCleanupAgentFactory,
    type EvaluationRecipeAgentFactory,
    type EvaluationTitleAgentFactory,
} from "~agent-worker/domain/evaluation/adapter/evaluation.agent.dispatch.js";

/** 평가가 배선할 수 있는 에이전트별 실제 구현 조립 표면이며, 아직 배선되지 않은 에이전트는 키를 비운다. */
export interface EvaluationAgentFactories {
    readonly title?: EvaluationTitleAgentFactory;
    readonly recipe?: EvaluationRecipeAgentFactory;
    readonly cleanup?: EvaluationCleanupAgentFactory;
}

/** 조립 근원이 주입한 에이전트 구현으로 실행 가능한 registry를 만든다. */
export function buildEvaluationAgentRegistry(
    factories: EvaluationAgentFactories,
    operationalFragments: readonly ResolvedPromptFragment[] = [],
): EvaluationAgentRegistry {
    return {
        ...(factories.title !== undefined
            ? { [AGENT.titleSuggestion.id]: { run: (envelope, ctx) => runTitleEvaluation(factories.title!, envelope, ctx, operationalFragments) } }
            : {}),
        ...(factories.recipe !== undefined
            ? { [AGENT.recipeScan.id]: { run: (envelope, ctx) => runRecipeEvaluation(factories.recipe!, envelope, ctx, operationalFragments) } }
            : {}),
        ...(factories.cleanup !== undefined
            ? { [AGENT.taskCleanup.id]: { run: (envelope, ctx) => runCleanupEvaluation(factories.cleanup!, envelope, ctx, operationalFragments) } }
            : {}),
    };
}
