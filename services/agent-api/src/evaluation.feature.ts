import { SystemClock } from "@tracer-agent/platform";
import type { DataSource } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import { EvaluationDatasetEntity, EvaluationExampleEntity } from "~agent-api/domain/evaluation/adapter/dataset.entity.js";
import { EvaluationUlidGenerator } from "~agent-api/domain/evaluation/adapter/evaluation.ulid.generator.js";
import { EvaluationExecutionReaderAdapter } from "~agent-api/domain/evaluation/adapter/execution.reader.adapter.js";
import { EvaluatorDefinitionEntity, EvaluatorSetEntity, EvaluatorSetMemberEntity } from "~agent-api/domain/evaluation/adapter/evaluator.entity.js";
import { TypeOrmEvaluationRepository } from "~agent-api/domain/evaluation/adapter/typeorm.evaluation.repository.adapter.js";
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
];

/** 평가 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const evaluationFeature = {
    controllers: [EvaluationDatasetController, EvaluationEvaluatorController, EvaluationCandidateController],
    providers: [
        ...useCases,
        EvaluationUlidGenerator,
        { provide: EVALUATION_ID_GENERATOR, useExisting: EvaluationUlidGenerator },
        { provide: EVALUATION_CLOCK, useClass: SystemClock },
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
] as const;
