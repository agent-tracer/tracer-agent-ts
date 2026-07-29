import {
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
} from "@nestjs/common";
import { MONITOR_USER_HEADER } from "@tracer-agent/platform";
import { CreateDatasetUseCase } from "../application/command/create.dataset.usecase.js";
import { DeleteDatasetUseCase } from "../application/command/delete.dataset.usecase.js";
import { ReviseDatasetUseCase } from "../application/command/revise.dataset.usecase.js";
import { ExportDpoUseCase } from "../application/query/export.dpo.usecase.js";
import { ExportSftUseCase } from "../application/query/export.sft.usecase.js";
import { GenerateQualityReportUseCase } from "../application/query/generate.quality.report.usecase.js";
import { GetDatasetUseCase } from "../application/query/get.dataset.usecase.js";
import { ListDatasetsUseCase } from "../application/query/list.datasets.usecase.js";
import { SuggestDatasetCandidatesUseCase } from "../application/query/suggest.dataset.candidates.usecase.js";
import { pathParamPipe } from "~agent-api/support/path-param.pipe.js";
import { resolveUserId } from "~agent-api/support/request-user.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import {
    createDatasetSchema,
    datasetCandidatesQuerySchema,
    reviseDatasetSchema,
    trainingExportSchema,
    type CreateDatasetPayload,
    type DatasetCandidatesQuery,
    type ReviseDatasetPayload,
    type TrainingExportPayload,
} from "./evaluation.schema.js";

@Controller("api/v1/evaluation/datasets")
export class EvaluationDatasetController {
    constructor(
        private readonly createDataset: CreateDatasetUseCase,
        private readonly deleteDataset: DeleteDatasetUseCase,
        private readonly reviseDataset: ReviseDatasetUseCase,
        private readonly listDatasets: ListDatasetsUseCase,
        private readonly getDataset: GetDatasetUseCase,
        private readonly candidates: SuggestDatasetCandidatesUseCase,
        private readonly qualityReport: GenerateQualityReportUseCase,
        private readonly exportSft: ExportSftUseCase,
        private readonly exportDpo: ExportDpoUseCase,
    ) {}

    @Get()
    list(@Headers(MONITOR_USER_HEADER) user: string | undefined) {
        return this.listDatasets.execute(resolveUserId(user));
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Body(new SchemaValidationPipe(createDatasetSchema)) body: CreateDatasetPayload,
    ) {
        return this.createDataset.execute({ userId: resolveUserId(user), ...body });
    }

    @Get(":id")
    get(@Headers(MONITOR_USER_HEADER) user: string | undefined, @Param("id", pathParamPipe) id: string) {
        return this.getDataset.execute(resolveUserId(user), id);
    }

    @Delete(":id")
    remove(@Headers(MONITOR_USER_HEADER) user: string | undefined, @Param("id", pathParamPipe) id: string) {
        return this.deleteDataset.execute(resolveUserId(user), id);
    }

    @Patch(":id")
    revise(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(reviseDatasetSchema)) body: ReviseDatasetPayload,
    ) {
        return this.reviseDataset.execute({ userId: resolveUserId(user), datasetId: id, examples: body.examples });
    }

    @Get(":id/candidates")
    suggest(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Query(new SchemaValidationPipe(datasetCandidatesQuerySchema)) query: DatasetCandidatesQuery,
    ) {
        return this.candidates.execute(resolveUserId(user), query.experimentId, query.scoreThreshold);
    }

    @Get(":id/quality")
    quality(@Headers(MONITOR_USER_HEADER) user: string | undefined, @Param("id", pathParamPipe) id: string) {
        return this.qualityReport.execute(resolveUserId(user), id);
    }

    @Post(":id/export/sft")
    sft(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(trainingExportSchema)) body: TrainingExportPayload,
    ) {
        return this.exportSft.execute(resolveUserId(user), id, body.datasetRevision ?? 1, body.experimentId, {
            disclosureClasses: body.disclosureClasses ?? ["synthetic", "approved-evaluation"],
            minScore: body.minScore ?? null,
            excludeDisabled: body.excludeDisabled ?? true,
        });
    }

    @Post(":id/export/dpo")
    dpo(
        @Headers(MONITOR_USER_HEADER) user: string | undefined,
        @Param("id", pathParamPipe) id: string,
        @Body(new SchemaValidationPipe(trainingExportSchema)) body: TrainingExportPayload,
    ) {
        return this.exportDpo.execute(resolveUserId(user), id, body.datasetRevision ?? 1, body.experimentId, {
            disclosureClasses: body.disclosureClasses ?? ["synthetic", "approved-evaluation"],
            minScore: body.minScore ?? null,
            excludeDisabled: body.excludeDisabled ?? true,
        });
    }
}
