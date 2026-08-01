import { SystemClock } from "@tracer-agent/platform";
import type { DataSource } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import { EvaluationDatasetEntity, EvaluationExampleEntity } from "~agent-api/domain/evaluation/adapter/dataset.entity.js";
import { EvaluationUlidGenerator } from "~agent-api/domain/evaluation/adapter/evaluation.ulid.generator.js";
import { EvaluationExecutionReaderAdapter } from "~agent-api/domain/evaluation/adapter/execution.reader.adapter.js";
import { EvaluatorDefinitionEntity, EvaluatorSetEntity, EvaluatorSetMemberEntity } from "~agent-api/domain/evaluation/adapter/evaluator.entity.js";
import { TypeOrmEvaluationRepository } from "~agent-api/domain/evaluation/adapter/typeorm.evaluation.repository.adapter.js";
import { ExperimentRow, ExperimentVariantRow } from "~agent-api/domain/evaluation/adapter/experiment.entity.js";
import { EvaluationExecutionSettlementRow, EvaluationScoreRow, ExperimentExecutionRow } from "~agent-api/domain/evaluation/adapter/experiment.execution.entity.js";
import { HumanReviewRevisionRow, HumanReviewRow } from "~agent-api/domain/evaluation/adapter/human.review.entity.js";
import { TypeOrmExperimentRepository } from "~agent-api/domain/evaluation/adapter/typeorm.experiment.repository.adapter.js";
import { ExperimentRandomAdapter } from "~agent-api/domain/evaluation/adapter/experiment.random.adapter.js";
import { TemporalExperimentDispatcher } from "~agent-api/domain/evaluation/adapter/temporal.experiment.dispatcher.js";
import { PromptChannelEntity, PromptDefinitionEntity, PromptPromotionEntity, PromptVersionEntity } from "~agent-api/domain/evaluation/adapter/prompt.entity.js";
import { PromptFragmentBindingEntity, PromptFragmentChannelEntity, PromptFragmentDefinitionEntity, PromptFragmentVersionEntity } from "~agent-api/domain/evaluation/adapter/prompt.fragment.entity.js";
import { TypeOrmPromptRepositoryAdapter } from "~agent-api/domain/evaluation/adapter/typeorm.prompt.repository.adapter.js";
import { CancelExperimentUseCase } from "~agent-api/domain/evaluation/application/command/cancel.experiment.usecase.js";
import { CreateExperimentUseCase } from "~agent-api/domain/evaluation/application/command/create.experiment.usecase.js";
import { DrawReviewPairUseCase } from "~agent-api/domain/evaluation/application/command/draw.review.pair.usecase.js";
import { StartExperimentUseCase } from "~agent-api/domain/evaluation/application/command/start.experiment.usecase.js";
import { SubmitReviewUseCase } from "~agent-api/domain/evaluation/application/command/submit.review.usecase.js";
import { CreatePromptUseCase } from "~agent-api/domain/evaluation/application/command/create.prompt.usecase.js";
import { CreatePromptVersionUseCase } from "~agent-api/domain/evaluation/application/command/create.prompt.version.usecase.js";
import { PromotePromptUseCase } from "~agent-api/domain/evaluation/application/command/promote.prompt.usecase.js";
import { RegisterAndResolvePromptFragmentsUseCase } from "~agent-api/domain/evaluation/application/command/register.and.resolve.prompt.fragments.usecase.js";
import { PromotePromptFragmentUseCase } from "~agent-api/domain/evaluation/application/command/promote.prompt.fragment.usecase.js";
import { RegisterCandidateFragmentVersionUseCase } from "~agent-api/domain/evaluation/application/command/register.candidate.fragment.version.usecase.js";
import { RegisterBackendPromptUseCase } from "~agent-api/domain/evaluation/application/command/register.backend.prompt.usecase.js";
import { RollbackPromptChannelUseCase } from "~agent-api/domain/evaluation/application/command/rollback.prompt.channel.usecase.js";
import { GetExperimentComparisonUseCase } from "~agent-api/domain/evaluation/application/query/get.experiment.comparison.usecase.js";
import { GetExperimentUseCase } from "~agent-api/domain/evaluation/application/query/get.experiment.usecase.js";
import { ListExperimentExecutionsUseCase } from "~agent-api/domain/evaluation/application/query/list.experiment.executions.usecase.js";
import { ListExperimentsUseCase } from "~agent-api/domain/evaluation/application/query/list.experiments.usecase.js";
import { ListReviewsUseCase } from "~agent-api/domain/evaluation/application/query/list.reviews.usecase.js";
import { PreviewExperimentUseCase } from "~agent-api/domain/evaluation/application/query/preview.experiment.usecase.js";
import { GetPromptChannelsUseCase } from "~agent-api/domain/evaluation/application/query/get.prompt.channels.usecase.js";
import { ListPromptFragmentCatalogUseCase } from "~agent-api/domain/evaluation/application/query/list.prompt.fragment.catalog.usecase.js";
import { ListPromptVersionsUseCase } from "~agent-api/domain/evaluation/application/query/list.prompt.versions.usecase.js";
import { ListPromptsUseCase } from "~agent-api/domain/evaluation/application/query/list.prompts.usecase.js";
import { PromptController } from "~agent-api/domain/evaluation/inbound/prompt.controller.js";
import { PromptFragmentController } from "~agent-api/domain/evaluation/inbound/prompt.fragment.controller.js";
import { EvaluationExecutionInternalController } from "~agent-api/domain/evaluation/inbound/evaluation.execution.internal.controller.js";
import { PromptInternalController } from "~agent-api/domain/evaluation/inbound/prompt.internal.controller.js";
import { FinalizeEvaluationExperimentUseCase } from "~agent-api/domain/evaluation/application/command/finalize.evaluation.experiment.usecase.js";
import { LeaseEvaluationExecutionUseCase } from "~agent-api/domain/evaluation/application/command/lease.evaluation.execution.usecase.js";
import { ReleaseEvaluationExecutionUseCase } from "~agent-api/domain/evaluation/application/command/release.evaluation.execution.usecase.js";
import { SettleEvaluationExecutionUseCase } from "~agent-api/domain/evaluation/application/command/settle.evaluation.execution.usecase.js";
import { EXPERIMENT_REPOSITORY } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";
import { EXPERIMENT_CLOCK, EXPERIMENT_DISPATCHER, EXPERIMENT_ID_GENERATOR, EXPERIMENT_RANDOM } from "~agent-api/domain/evaluation/port/experiment.support.port.js";
import { PROMPT_REPOSITORY } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
import { PROMPT_CLOCK, PROMPT_ID_GENERATOR } from "~agent-api/domain/evaluation/port/prompt.runtime.port.js";
import { CreateDatasetUseCase } from "~agent-api/domain/evaluation/application/command/create.dataset.usecase.js";
import { DeleteDatasetUseCase } from "~agent-api/domain/evaluation/application/command/delete.dataset.usecase.js";
import { ReviseDatasetUseCase } from "~agent-api/domain/evaluation/application/command/revise.dataset.usecase.js";
import { BuildChatExecutionExampleCandidateUseCase } from "~agent-api/domain/evaluation/application/query/build.chat.execution.example.candidate.usecase.js";
import { BuildExecutionExampleCandidateUseCase } from "~agent-api/domain/evaluation/application/query/build.execution.example.candidate.usecase.js";
import { ExportDpoUseCase } from "~agent-api/domain/evaluation/application/query/export.dpo.usecase.js";
import { ExportSftUseCase } from "~agent-api/domain/evaluation/application/query/export.sft.usecase.js";
import { GenerateQualityReportUseCase } from "~agent-api/domain/evaluation/application/query/generate.quality.report.usecase.js";
import { GetDatasetUseCase } from "~agent-api/domain/evaluation/application/query/get.dataset.usecase.js";
import { GetEvaluatorSetUseCase } from "~agent-api/domain/evaluation/application/query/get.evaluator.set.usecase.js";
import { ListDatasetsUseCase } from "~agent-api/domain/evaluation/application/query/list.datasets.usecase.js";
import { ListEvaluatorsUseCase } from "~agent-api/domain/evaluation/application/query/list.evaluators.usecase.js";
import { SuggestDatasetCandidatesUseCase } from "~agent-api/domain/evaluation/application/query/suggest.dataset.candidates.usecase.js";
import { EvaluationCandidateController } from "~agent-api/domain/evaluation/inbound/evaluation.candidate.controller.js";
import { EvaluationDatasetController } from "~agent-api/domain/evaluation/inbound/evaluation.dataset.controller.js";
import { EvaluationEvaluatorController } from "~agent-api/domain/evaluation/inbound/evaluation.evaluator.controller.js";
import { EvaluationExperimentController } from "~agent-api/domain/evaluation/inbound/evaluation.experiment.controller.js";
import { EvaluationReviewController } from "~agent-api/domain/evaluation/inbound/evaluation.review.controller.js";
import { EVALUATION_CLOCK } from "~agent-api/domain/evaluation/port/clock.port.js";
import { EVALUATION_REPOSITORY } from "~agent-api/domain/evaluation/port/evaluation.repository.port.js";
import { EVALUATION_EXECUTION_READER } from "~agent-api/domain/evaluation/port/execution.reader.port.js";
import { EVALUATION_ID_GENERATOR } from "~agent-api/domain/evaluation/port/id.generator.port.js";

const useCases = [
    CreateDatasetUseCase,
    DeleteDatasetUseCase,
    ReviseDatasetUseCase,
    BuildChatExecutionExampleCandidateUseCase,
    BuildExecutionExampleCandidateUseCase,
    ExportDpoUseCase,
    ExportSftUseCase,
    GenerateQualityReportUseCase,
    GetDatasetUseCase,
    GetEvaluatorSetUseCase,
    ListDatasetsUseCase,
    ListEvaluatorsUseCase,
    SuggestDatasetCandidatesUseCase,
    CancelExperimentUseCase,
    CreateExperimentUseCase,
    DrawReviewPairUseCase,
    StartExperimentUseCase,
    SubmitReviewUseCase,
    GetExperimentComparisonUseCase,
    GetExperimentUseCase,
    ListExperimentExecutionsUseCase,
    ListExperimentsUseCase,
    ListReviewsUseCase,
    PreviewExperimentUseCase,
    CreatePromptUseCase,
    CreatePromptVersionUseCase,
    PromotePromptUseCase,
    RegisterAndResolvePromptFragmentsUseCase,
    RegisterCandidateFragmentVersionUseCase,
    PromotePromptFragmentUseCase,
    RegisterBackendPromptUseCase,
    RollbackPromptChannelUseCase,
    GetPromptChannelsUseCase,
    ListPromptFragmentCatalogUseCase,
    ListPromptVersionsUseCase,
    ListPromptsUseCase,
    LeaseEvaluationExecutionUseCase,
    SettleEvaluationExecutionUseCase,
    ReleaseEvaluationExecutionUseCase,
    FinalizeEvaluationExperimentUseCase,
];

/** 평가 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const evaluationFeature = {
    controllers: [
        EvaluationDatasetController,
        EvaluationEvaluatorController,
        EvaluationCandidateController,
        EvaluationExperimentController,
        EvaluationReviewController,
        PromptController,
        PromptFragmentController,
        PromptInternalController,
        EvaluationExecutionInternalController,
    ],
    providers: [
        ...useCases,
        EvaluationUlidGenerator,
        { provide: EVALUATION_ID_GENERATOR, useExisting: EvaluationUlidGenerator },
        { provide: EVALUATION_CLOCK, useClass: SystemClock },
        { provide: EXPERIMENT_CLOCK, useClass: SystemClock },
        { provide: PROMPT_CLOCK, useClass: SystemClock },
        { provide: EXPERIMENT_ID_GENERATOR, useExisting: EvaluationUlidGenerator },
        { provide: PROMPT_ID_GENERATOR, useExisting: EvaluationUlidGenerator },
        ExperimentRandomAdapter,
        { provide: EXPERIMENT_RANDOM, useExisting: ExperimentRandomAdapter },
        TemporalExperimentDispatcher,
        { provide: EXPERIMENT_DISPATCHER, useExisting: TemporalExperimentDispatcher },
        TypeOrmPromptRepositoryAdapter,
        { provide: PROMPT_REPOSITORY, useExisting: TypeOrmPromptRepositoryAdapter },
        {
            provide: EVALUATION_REPOSITORY,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) => new TypeOrmEvaluationRepository({
                datasets: source.getRepository(EvaluationDatasetEntity),
                examples: source.getRepository(EvaluationExampleEntity),
                evaluators: source.getRepository(EvaluatorDefinitionEntity),
                evaluatorSets: source.getRepository(EvaluatorSetEntity),
                evaluatorMembers: source.getRepository(EvaluatorSetMemberEntity),
            }),
        },
        {
            provide: EXPERIMENT_REPOSITORY,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) => new TypeOrmExperimentRepository(source),
        },
        {
            provide: EVALUATION_EXECUTION_READER,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) => new EvaluationExecutionReaderAdapter(source),
        },
    ],
};

/** 평가 데이터셋과 평가자 카탈로그의 저장 스키마다. */
export const EVALUATION_ENTITIES = [
    EvaluationDatasetEntity,
    EvaluationExampleEntity,
    EvaluatorDefinitionEntity,
    EvaluatorSetEntity,
    EvaluatorSetMemberEntity,
    ExperimentRow,
    ExperimentVariantRow,
    ExperimentExecutionRow,
    EvaluationExecutionSettlementRow,
    EvaluationScoreRow,
    HumanReviewRow,
    HumanReviewRevisionRow,
    PromptDefinitionEntity,
    PromptVersionEntity,
    PromptChannelEntity,
    PromptPromotionEntity,
    PromptFragmentDefinitionEntity,
    PromptFragmentVersionEntity,
    PromptFragmentBindingEntity,
    PromptFragmentChannelEntity,
] as const;
