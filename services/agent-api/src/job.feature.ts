import { loadApplicationConfig, SystemClock } from "@tracer-agent/platform";
import type { DataSource } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import { JobEntity } from "~agent-api/domain/job/adapter/job.entity.js";
import { JobStepEntity } from "~agent-api/domain/job/adapter/job.step.entity.js";
import { JobUlidGenerator } from "~agent-api/domain/job/adapter/job.ulid.generator.js";
import { JobWorkflowDispatcher } from "~agent-api/domain/job/adapter/job.workflow.dispatcher.js";
import { KafkaJobStatusNotifier } from "~agent-api/domain/job/adapter/kafka.job.status.notifier.js";
import { StructuredJobEventLogAdapter } from "~agent-api/domain/job/adapter/structured.job.event.log.adapter.js";
import { TypeOrmJobRepository } from "~agent-api/domain/job/adapter/typeorm.job.repository.adapter.js";
import { TypeOrmJobStepRepository } from "~agent-api/domain/job/adapter/typeorm.job.step.repository.adapter.js";
import { CancelJobUseCase } from "~agent-api/domain/job/application/command/cancel.job.usecase.js";
import { EnqueueJobUseCase } from "~agent-api/domain/job/application/command/enqueue.job.usecase.js";
import { IssueJobExecutionEnvelopeUseCase } from "~agent-api/domain/job/application/command/issue.job.execution.envelope.usecase.js";
import { GetJobStepsUseCase } from "~agent-api/domain/job/application/query/get.job.steps.usecase.js";
import { GetJobUseCase } from "~agent-api/domain/job/application/query/get.job.usecase.js";
import { GetLatestJobUseCase } from "~agent-api/domain/job/application/query/get.latest.job.usecase.js";
import { ListJobHistoryUseCase } from "~agent-api/domain/job/application/query/list.job.history.usecase.js";
import { ListPendingJobsUseCase } from "~agent-api/domain/job/application/query/list.pending.jobs.usecase.js";
import { JobCommandController } from "~agent-api/domain/job/inbound/job.command.controller.js";
import { JobInternalController } from "~agent-api/domain/job/inbound/job.internal.controller.js";
import { JobQueryController } from "~agent-api/domain/job/inbound/job.query.controller.js";
import { JOB_CLOCK } from "~agent-api/domain/job/port/clock.port.js";
import { JOB_EVENT_LOG } from "~agent-api/domain/job/port/job.event.log.port.js";
import { JOB_ID_GENERATOR } from "~agent-api/domain/job/port/job.id.generator.port.js";
import { JOB_REPOSITORY } from "~agent-api/domain/job/port/job.repository.port.js";
import { JOB_STATUS_NOTIFIER } from "~agent-api/domain/job/port/job.status.notifier.port.js";
import { JOB_STEP_REPOSITORY } from "~agent-api/domain/job/port/job.step.repository.port.js";
import { LOCAL_CLI_AUTH } from "~agent-api/domain/job/port/local.cli.auth.port.js";
import { TracerApiWindow } from "@tracer-agent/tracer-client";
import { TRACER_API_WINDOW } from "~agent-api/config/tracer.api.token.js";
import { SCAN_ANCHOR_READER } from "~agent-api/domain/job/port/scan.anchor.reader.port.js";
import { ScanAnchorReaderAdapter } from "~agent-api/domain/job/adapter/scan.anchor.reader.adapter.js";
import { JOB_SETTING_READER } from "~agent-api/domain/job/port/setting.reader.port.js";
import { SETTING_REPOSITORY } from "~agent-api/domain/settings/port/setting.repository.port.js";
import { WORKFLOW_DISPATCHER } from "~agent-api/domain/job/port/workflow.dispatcher.port.js";

/** job 슬라이스가 조립 근원에 공급하는 컨트롤러와 프로바이더 목록이다. */
export const jobFeature = {
    controllers: [JobQueryController, JobCommandController, JobInternalController],
    providers: [
        CancelJobUseCase,
        EnqueueJobUseCase,
        IssueJobExecutionEnvelopeUseCase,
        GetJobStepsUseCase,
        GetJobUseCase,
        GetLatestJobUseCase,
        ListJobHistoryUseCase,
        ListPendingJobsUseCase,
        JobWorkflowDispatcher,
        { provide: WORKFLOW_DISPATCHER, useExisting: JobWorkflowDispatcher },
        KafkaJobStatusNotifier,
        { provide: JOB_STATUS_NOTIFIER, useExisting: KafkaJobStatusNotifier },
        StructuredJobEventLogAdapter,
        { provide: JOB_EVENT_LOG, useExisting: StructuredJobEventLogAdapter },
        { provide: JOB_SETTING_READER, useExisting: SETTING_REPOSITORY },
        {
            provide: TRACER_API_WINDOW,
            useFactory: (): TracerApiWindow => new TracerApiWindow(resolveTracerApiBaseUrl()),
        },
        ScanAnchorReaderAdapter,
        { provide: SCAN_ANCHOR_READER, useExisting: ScanAnchorReaderAdapter },
        { provide: JOB_CLOCK, useClass: SystemClock },
        JobUlidGenerator,
        { provide: JOB_ID_GENERATOR, useExisting: JobUlidGenerator },
        // 로컬 자격으로 실행되는 프로파일에서는 접수가 API 키를 묻지 않는다.
        { provide: LOCAL_CLI_AUTH, useFactory: () => loadApplicationConfig().profile === "local" },
        {
            provide: JOB_REPOSITORY,
            inject: [AGENT_DATA_SOURCE, JobUlidGenerator],
            useFactory: (source: DataSource, ids: JobUlidGenerator) =>
                new TypeOrmJobRepository(source.getRepository(JobEntity), source, ids),
        },
        {
            provide: JOB_STEP_REPOSITORY,
            inject: [AGENT_DATA_SOURCE],
            useFactory: (source: DataSource) => new TypeOrmJobStepRepository(source.getRepository(JobStepEntity)),
        },
    ],
};

/** 잡 원장의 표를 비추는 엔티티다. */
export const JOB_ENTITIES = [JobEntity, JobStepEntity] as const;

/** 접수가 근거 이벤트를 확인하러 부르는 추적 API의 기점이다. */
function resolveTracerApiBaseUrl(): string {
    return process.env["TRACER_API_URL"] ?? "http://127.0.0.1:3902";
}
