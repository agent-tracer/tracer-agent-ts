import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { CancelExperimentUseCase } from "../application/command/cancel.experiment.usecase.js";
import { CreateExperimentUseCase } from "../application/command/create.experiment.usecase.js";
import { StartExperimentUseCase } from "../application/command/start.experiment.usecase.js";
import { GetExperimentComparisonUseCase } from "../application/query/get.experiment.comparison.usecase.js";
import { GetExperimentUseCase } from "../application/query/get.experiment.usecase.js";
import { ListExperimentExecutionsUseCase } from "../application/query/list.experiment.executions.usecase.js";
import { ListExperimentsUseCase } from "../application/query/list.experiments.usecase.js";
import { PreviewExperimentUseCase } from "../application/query/preview.experiment.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import {
    createExperimentSchema,
    startExperimentSchema,
    type CreateExperimentPayload,
    type StartExperimentPayload,
} from "./experiment.schema.js";

@Controller("api/agent/evaluation/experiments")
export class EvaluationExperimentController {
    constructor(
        private readonly listExperiments: ListExperimentsUseCase,
        private readonly createExperiment: CreateExperimentUseCase,
        private readonly getExperiment: GetExperimentUseCase,
        private readonly previewExperiment: PreviewExperimentUseCase,
        private readonly listExecutions: ListExperimentExecutionsUseCase,
        private readonly comparison: GetExperimentComparisonUseCase,
        private readonly startExperiment: StartExperimentUseCase,
        private readonly cancelExperiment: CancelExperimentUseCase,
    ) {}

    @Get()
    list(@Headers(MONITOR_USER_HEADER) user: string | undefined) {
        return this.listExperiments.execute(resolveUserId(user));
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(createExperimentSchema)) body: CreateExperimentPayload,
    ) {
        return this.createExperiment.execute({ userId: resolveUserId(user), ...body });
    }

    @Get(":id")
    get(@Headers(MONITOR_USER_HEADER) user: string | undefined, @Param("id", pathParamPipe) id: string) {
        return this.getExperiment.execute(resolveUserId(user), id);
    }

    @Get(":id/preview")
    preview(@Headers(MONITOR_USER_HEADER) user: string | undefined, @Param("id", pathParamPipe) id: string) {
        return this.previewExperiment.execute(resolveUserId(user), id);
    }

    @Get(":id/executions")
    executions(@Headers(MONITOR_USER_HEADER) user: string | undefined, @Param("id", pathParamPipe) id: string) {
        return this.listExecutions.execute(resolveUserId(user), id);
    }

    @Get(":id/comparison")
    compare(@Headers(MONITOR_USER_HEADER) user: string | undefined, @Param("id", pathParamPipe) id: string) {
        return this.comparison.execute(resolveUserId(user), id);
    }

    @Post(":id/start")
    start(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(startExperimentSchema)) body: StartExperimentPayload,
    ) {
        return this.startExperiment.execute(resolveUserId(user), id, body.confirmation);
    }

    @Post(":id/cancel")
    cancel(@Headers(MONITOR_USER_HEADER) user: string | undefined, @Param("id", pathParamPipe) id: string) {
        return this.cancelExperiment.execute(resolveUserId(user), id);
    }
}
