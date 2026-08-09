import { SystemClock } from "@tracer-agent/platform";
import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import type { DataSource } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import { TRACER_API_WINDOW } from "~agent-api/config/tracer.api.token.js";
import { CleanupSuggestionEntity } from "~agent-api/domain/cleanup/adapter/cleanup.suggestion.entity.js";
import { TracerTaskArchiverAdapter } from "~agent-api/domain/cleanup/adapter/tracer.task.archiver.adapter.js";
import { TypeOrmCleanupSuggestionRepository } from "~agent-api/domain/cleanup/adapter/typeorm.cleanup.suggestion.repository.adapter.js";
import { AcceptCleanupSuggestionUseCase } from "~agent-api/domain/cleanup/application/command/accept.cleanup.suggestion.usecase.js";
import { DismissCleanupSuggestionUseCase } from "~agent-api/domain/cleanup/application/command/dismiss.cleanup.suggestion.usecase.js";
import { ListCleanupSuggestionsUseCase } from "~agent-api/domain/cleanup/application/query/list.cleanup.suggestions.usecase.js";
import { CleanupController } from "~agent-api/domain/cleanup/inbound/cleanup.controller.js";
import { CLEANUP_CLOCK } from "~agent-api/domain/cleanup/port/clock.port.js";
import { CLEANUP_SUGGESTION_REPOSITORY } from "~agent-api/domain/cleanup/port/cleanup.repository.port.js";
import { CLEANUP_TASK_ARCHIVER } from "~agent-api/domain/cleanup/port/cleanup.task.archiver.port.js";

/** cleanup 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const cleanupFeature = {
    controllers: [CleanupController],
    providers: [
        AcceptCleanupSuggestionUseCase,
        DismissCleanupSuggestionUseCase,
        ListCleanupSuggestionsUseCase,
        { provide: CLEANUP_CLOCK, useClass: SystemClock },
        {
            provide: CLEANUP_SUGGESTION_REPOSITORY,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) =>
                new TypeOrmCleanupSuggestionRepository(source.getRepository(CleanupSuggestionEntity)),
        },
        {
            provide: CLEANUP_TASK_ARCHIVER,
            inject: [TRACER_API_WINDOW],
            useFactory: (tracer: TracerApiWindow) => new TracerTaskArchiverAdapter(tracer),
        },
    ],
};

/** 정리 제안 원장의 표를 비추는 엔티티다. */
export const CLEANUP_ENTITIES = [CleanupSuggestionEntity] as const;
