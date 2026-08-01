import { SystemClock } from "@tracer-agent/platform";
import { PromptChannelEntity, PromptDefinitionEntity, PromptPromotionEntity, PromptVersionEntity } from "~agent-api/domain/evaluation/adapter/prompt.entity.js";
import { PromptFragmentBindingEntity, PromptFragmentChannelEntity, PromptFragmentDefinitionEntity, PromptFragmentVersionEntity } from "~agent-api/domain/evaluation/adapter/prompt.fragment.entity.js";
import { PromptUlidGenerator } from "~agent-api/domain/evaluation/adapter/prompt.ulid.generator.js";
import { TypeOrmPromptRepositoryAdapter } from "~agent-api/domain/evaluation/adapter/typeorm.prompt.repository.adapter.js";
import { CreatePromptUseCase } from "~agent-api/domain/evaluation/application/command/create.prompt.usecase.js";
import { CreatePromptVersionUseCase } from "~agent-api/domain/evaluation/application/command/create.prompt.version.usecase.js";
import { PromotePromptUseCase } from "~agent-api/domain/evaluation/application/command/promote.prompt.usecase.js";
import { RegisterAndResolvePromptFragmentsUseCase } from "~agent-api/domain/evaluation/application/command/register.and.resolve.prompt.fragments.usecase.js";
import { PromotePromptFragmentUseCase } from "~agent-api/domain/evaluation/application/command/promote.prompt.fragment.usecase.js";
import { RegisterCandidateFragmentVersionUseCase } from "~agent-api/domain/evaluation/application/command/register.candidate.fragment.version.usecase.js";
import { RegisterBackendPromptUseCase } from "~agent-api/domain/evaluation/application/command/register.backend.prompt.usecase.js";
import { RollbackPromptChannelUseCase } from "~agent-api/domain/evaluation/application/command/rollback.prompt.channel.usecase.js";
import { GetPromptChannelsUseCase } from "~agent-api/domain/evaluation/application/query/get.prompt.channels.usecase.js";
import { ListPromptFragmentCatalogUseCase } from "~agent-api/domain/evaluation/application/query/list.prompt.fragment.catalog.usecase.js";
import { ListPromptVersionsUseCase } from "~agent-api/domain/evaluation/application/query/list.prompt.versions.usecase.js";
import { ListPromptsUseCase } from "~agent-api/domain/evaluation/application/query/list.prompts.usecase.js";
import { PromptController } from "~agent-api/domain/evaluation/inbound/prompt.controller.js";
import { PromptFragmentController } from "~agent-api/domain/evaluation/inbound/prompt.fragment.controller.js";
import { PromptInternalController } from "~agent-api/domain/evaluation/inbound/prompt.internal.controller.js";
import { PROMPT_REPOSITORY } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
import { PROMPT_CLOCK, PROMPT_ID_GENERATOR } from "~agent-api/domain/evaluation/port/prompt.runtime.port.js";

const useCases = [
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
];

/** 프롬프트 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const evaluationFeature = {
    controllers: [
        PromptController,
        PromptFragmentController,
        PromptInternalController,
    ],
    providers: [
        ...useCases,
        PromptUlidGenerator,
        { provide: PROMPT_CLOCK, useClass: SystemClock },
        { provide: PROMPT_ID_GENERATOR, useExisting: PromptUlidGenerator },
        TypeOrmPromptRepositoryAdapter,
        { provide: PROMPT_REPOSITORY, useExisting: TypeOrmPromptRepositoryAdapter },
    ],
};

/** 프롬프트와 프롬프트 조각 카탈로그의 저장 스키마다. */
export const EVALUATION_ENTITIES = [
    PromptDefinitionEntity,
    PromptVersionEntity,
    PromptChannelEntity,
    PromptPromotionEntity,
    PromptFragmentDefinitionEntity,
    PromptFragmentVersionEntity,
    PromptFragmentBindingEntity,
    PromptFragmentChannelEntity,
] as const;
