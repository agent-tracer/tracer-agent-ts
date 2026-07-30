import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { DrawReviewPairUseCase } from "../application/command/draw.review.pair.usecase.js";
import { SubmitReviewUseCase } from "../application/command/submit.review.usecase.js";
import { ListReviewsUseCase } from "../application/query/list.reviews.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import { submitReviewSchema, type SubmitReviewPayload } from "./experiment.schema.js";

@Controller("api/agent/evaluation/experiments/:experimentId/reviews")
export class EvaluationReviewController {
    constructor(
        private readonly listReviews: ListReviewsUseCase,
        private readonly drawPair: DrawReviewPairUseCase,
        private readonly submitReview: SubmitReviewUseCase,
    ) {}

    @Get()
    list(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("experimentId", pathParamPipe) experimentId: string,
    ) {
        return this.listReviews.execute(resolveUserId(user), experimentId);
    }

    @Post("next")
    @HttpCode(HttpStatus.OK)
    next(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("experimentId", pathParamPipe) experimentId: string,
    ) {
        return this.drawPair.execute(resolveUserId(user), experimentId);
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    submit(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("experimentId", pathParamPipe) experimentId: string,
        @Body(new SchemaValidationPipe(submitReviewSchema)) body: SubmitReviewPayload,
    ) {
        return this.submitReview.execute({
            userId: resolveUserId(user),
            experimentId,
            executionAId: body.executionAId,
            executionBId: body.executionBId,
            preference: body.preference,
            reason: body.reason ?? null,
            correctedOutput: body.correctedOutput ?? null,
        });
    }
}
