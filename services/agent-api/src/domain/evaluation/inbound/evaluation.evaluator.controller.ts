import { Controller, Get, Param } from "@nestjs/common";
import { GetEvaluatorSetUseCase } from "../application/query/get.evaluator.set.usecase.js";
import { ListEvaluatorSetsUseCase } from "../application/query/list.evaluator.sets.usecase.js";
import { ListEvaluatorsUseCase } from "../application/query/list.evaluators.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";

@Controller("api/agent/evaluation/evaluators")
export class EvaluationEvaluatorController {
    constructor(
        private readonly listEvaluators: ListEvaluatorsUseCase,
        private readonly getEvaluatorSet: GetEvaluatorSetUseCase,
        private readonly listEvaluatorSets: ListEvaluatorSetsUseCase,
    ) {}

    @Get()
    list() {
        return this.listEvaluators.execute();
    }

    @Get("sets")
    sets() {
        return this.listEvaluatorSets.execute();
    }

    @Get("sets/:version")
    set(@Param("version", pathParamPipe) version: string) {
        return this.getEvaluatorSet.execute(version);
    }
}
