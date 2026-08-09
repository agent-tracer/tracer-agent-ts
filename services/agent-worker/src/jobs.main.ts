import "reflect-metadata";
import { assertTraceEnvironment, ClaudeQueryRunner } from "@tracer-agent/llm";
import { TracerApiWindow } from "@tracer-agent/tracer-client";
import {
    createDataSource,
    errorMessage,
    loadApplicationConfig,
    logError,
    logInfo,
    SystemClock,
} from "@tracer-agent/platform";
import { AgentRunObservationEntity } from "~agent-worker/config/ledger/agent.run.observation.entity.js";
import { AiJobEntity } from "~agent-worker/config/ledger/ai.job.entity.js";
import { AiJobStageOutputEntity } from "~agent-worker/config/ledger/ai.job.stage.output.entity.js";
import { AiJobStepEntity } from "~agent-worker/config/ledger/ai.job.step.entity.js";
import { CleanupSuggestionRowEntity } from "~agent-worker/config/ledger/cleanup.suggestion.entity.js";
import { RecipeRowEntity } from "~agent-worker/config/ledger/recipe.entity.js";
import { SearchOutboxRowEntity } from "~agent-worker/config/ledger/search.outbox.entity.js";
import { createKafka } from "~agent-worker/config/kafka.factory.js";
import { createNotificationPublisher } from "~agent-worker/config/notification.js";
import { resolveAgentApiUrl, resolveTracerApiUrl } from "~agent-worker/config/service.url.js";
import { JOB_TASK_QUEUE } from "~agent-worker/config/queue.const.js";
import { createTemporalWorker } from "~agent-worker/config/temporal.worker.js";
import { runUntilShutdown } from "~agent-worker/config/worker.lifecycle.js";
import { JobNotification } from "~agent-worker/support/job.notification.js";
import { RecipeOutputAdapter } from "~agent-worker/domain/recipe/adapter/recipe.output.adapter.js";
import { RecipeReaderAdapter } from "~agent-worker/domain/recipe/adapter/recipe.reader.adapter.js";
import { RecipeSearchAdapter } from "~agent-worker/domain/recipe/adapter/recipe.search.adapter.js";
import { RecipeJobLedgerAdapter } from "~agent-worker/domain/recipe/adapter/recipe.job.ledger.adapter.js";
import { RecipeSettingReaderAdapter } from "~agent-worker/domain/recipe/adapter/recipe.setting.reader.adapter.js";
import { RecipeTaskReaderAdapter } from "~agent-worker/domain/recipe/adapter/recipe.task.reader.adapter.js";
import { RecipeAgentAdapter } from "~agent-worker/domain/recipe/adapter/recipe.agent.adapter.js";
import { RecipeStageOutputAdapter } from "~agent-worker/domain/recipe/adapter/recipe.stage.output.adapter.js";
import { RunRecipeStageUsecase } from "~agent-worker/domain/recipe/application/run.recipe.stage.usecase.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { ContractPromptSource } from "~agent-worker/support/contract.prompt.source.js";
import { UlidGenerator } from "~agent-worker/support/ulid.generator.js";
import { FailRecipeJobUsecase } from "~agent-worker/domain/recipe/application/fail.recipe.job.usecase.js";
import { FinalizeRecipeScanUsecase } from "~agent-worker/domain/recipe/application/finalize.recipe.scan.usecase.js";
import { PrepareRecipeScanUsecase } from "~agent-worker/domain/recipe/application/prepare.recipe.scan.usecase.js";
import { ScanRecipeUsecase } from "~agent-worker/domain/recipe/application/scan.recipe.usecase.js";
import { RecipeActivity } from "~agent-worker/domain/recipe/inbound/recipe.activity.js";
import { CleanupObservedActivityAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.observed.activity.adapter.js";
import { CleanupOutputAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.output.adapter.js";
import { CleanupReaderAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.reader.adapter.js";
import { CleanupJobLedgerAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.job.ledger.adapter.js";
import { CleanupSettingReaderAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.setting.reader.adapter.js";
import { CleanupTaskReaderAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.task.reader.adapter.js";
import { CleanupSdkAgentAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.sdk.agent.adapter.js";
import { FailCleanupJobUsecase } from "~agent-worker/domain/cleanup/application/fail.cleanup.job.usecase.js";
import { FinalizeTaskCleanupUsecase } from "~agent-worker/domain/cleanup/application/finalize.task.cleanup.usecase.js";
import { PrepareTaskCleanupUsecase } from "~agent-worker/domain/cleanup/application/prepare.task.cleanup.usecase.js";

import { SuggestCleanupUsecase } from "~agent-worker/domain/cleanup/application/suggest.cleanup.usecase.js";
import { CleanupActivity } from "~agent-worker/domain/cleanup/inbound/cleanup.activity.js";
import { TitleEventReaderAdapter } from "~agent-worker/domain/title/adapter/title.event.reader.adapter.js";
import { TitleJobLedgerAdapter } from "~agent-worker/domain/title/adapter/title.job.ledger.adapter.js";
import { TitleSettingReaderAdapter } from "~agent-worker/domain/title/adapter/title.setting.reader.adapter.js";
import { TitleTaskReaderAdapter } from "~agent-worker/domain/title/adapter/title.task.reader.adapter.js";
import { TitleAgentAdapter } from "~agent-worker/domain/title/adapter/title.agent.adapter.js";

import { FailTitleJobUsecase } from "~agent-worker/domain/title/application/fail.title.job.usecase.js";
import { FinalizeTitleSuggestionUsecase } from "~agent-worker/domain/title/application/finalize.title.suggestion.usecase.js";
import { PrepareTitleSuggestionUsecase } from "~agent-worker/domain/title/application/prepare.title.suggestion.usecase.js";
import { SuggestTitleUsecase } from "~agent-worker/domain/title/application/suggest.title.usecase.js";
import { TitleActivity } from "~agent-worker/domain/title/inbound/title.activity.js";

/** 이 워커가 소유한 잡 원장을 비추는 엔티티이며 스키마의 진실은 계약의 SQL이다. */
const JOB_ENTITIES = [
    AiJobEntity,
    AiJobStageOutputEntity,
    AiJobStepEntity,
    AgentRunObservationEntity,
    RecipeRowEntity,
    SearchOutboxRowEntity,
    CleanupSuggestionRowEntity,
] as const;

async function bootstrap(): Promise<void> {
    assertTraceEnvironment();
    const config = loadApplicationConfig();
    const dataSource = createDataSource({ db: config.agentDb, entities: [...JOB_ENTITIES] });
    await dataSource.initialize();

    const producer = createKafka("agent-worker-jobs").producer();
    await producer.connect();
    const clock = new SystemClock();
    const publish = createNotificationPublisher(producer);
    const isLocal = config.profile === "local";
    const claudeRunner = new ClaudeQueryRunner(isLocal, isLocal);
    const tracer = new TracerApiWindow(resolveTracerApiUrl());
    // 레시피 검색은 이 축이 소유한 원장을 보므로 자기 API 를 부른다.
    const agentApi = new TracerApiWindow(resolveAgentApiUrl(config.agentApi.port));

    const recipeIds = new UlidGenerator();
    const recipeReader = new RecipeReaderAdapter(tracer);
    const recipeSearch = new RecipeSearchAdapter(tracer, agentApi);
    const recipeJobs = new RecipeJobLedgerAdapter(dataSource);
    const recipeSettings = new RecipeSettingReaderAdapter(dataSource);
    const recipeTasks = new RecipeTaskReaderAdapter(tracer);
    const recipeOutput = new RecipeOutputAdapter(dataSource, recipeIds, clock);
    const recipeNotification = new JobNotification(publish);
    const recipePrompts = new ContractPromptSource(AGENT.recipeScan.id);
    const recipeStageOutputs = new RecipeStageOutputAdapter(dataSource);
    const recipeStages = new RunRecipeStageUsecase(recipeStageOutputs, clock);
    const recipeAgent = new RecipeAgentAdapter(claudeRunner, {
        tasks: recipeReader,
        events: recipeReader,
        rules: recipeReader,
        search: recipeSearch,
    }, recipePrompts, recipeStages);
    const recipe = new RecipeActivity(
        new PrepareRecipeScanUsecase(recipeJobs, recipeSettings, recipeTasks, recipeAgent, recipeNotification, clock, recipePrompts),
        new ScanRecipeUsecase(recipeJobs, recipeSettings, recipeTasks, recipeAgent, clock, recipeIds),
        new FinalizeRecipeScanUsecase(
            recipeJobs,
            recipeOutput,
            recipeNotification,
            clock,
            recipeStageOutputs,
        ),
        new FailRecipeJobUsecase(recipeJobs, recipeNotification, clock, recipeStageOutputs),
    );

    const titleIds = new UlidGenerator(clock);
    const titleReader = new TitleEventReaderAdapter(tracer);
    const titleJobs = new TitleJobLedgerAdapter(dataSource);
    const titleSettings = new TitleSettingReaderAdapter(dataSource);
    const titleTasks = new TitleTaskReaderAdapter(tracer);
    const titleNotification = new JobNotification(publish);
    const titlePrompts = new ContractPromptSource(AGENT.titleSuggestion.id);
    const titleAgent = new TitleAgentAdapter(claudeRunner, titleReader, titlePrompts);
    const title = new TitleActivity(
        new PrepareTitleSuggestionUsecase(titleJobs, titleSettings, titleTasks, titleAgent, titleNotification, clock, titlePrompts),
        new SuggestTitleUsecase(titleJobs, titleSettings, titleAgent, clock, titleIds),
        new FinalizeTitleSuggestionUsecase(titleJobs, titleNotification, clock),
        new FailTitleJobUsecase(titleJobs, titleNotification, clock),
    );

    const cleanupIds = new UlidGenerator();
    const cleanupReader = new CleanupReaderAdapter(tracer);
    const cleanupJobs = new CleanupJobLedgerAdapter(dataSource);
    const cleanupSettings = new CleanupSettingReaderAdapter(dataSource);
    const cleanupTasks = new CleanupTaskReaderAdapter(tracer);
    const cleanupOutput = new CleanupOutputAdapter(
        dataSource,
        cleanupIds,
        clock,
        new CleanupObservedActivityAdapter(tracer),
    );
    const cleanupNotification = new JobNotification(publish);
    const cleanupPrompts = new ContractPromptSource(AGENT.taskCleanup.id);
    const cleanupAgent = new CleanupSdkAgentAdapter(claudeRunner, {
        tasks: cleanupReader,
        events: cleanupReader,
    }, cleanupPrompts);
    const cleanup = new CleanupActivity(
        new PrepareTaskCleanupUsecase(cleanupJobs, cleanupSettings, cleanupTasks, cleanupAgent, cleanupNotification, clock, cleanupPrompts),
        new SuggestCleanupUsecase(cleanupJobs, cleanupSettings, cleanupAgent, clock, cleanupIds),
        new FinalizeTaskCleanupUsecase(cleanupJobs, cleanupOutput, cleanupNotification, clock),
        new FailCleanupJobUsecase(cleanupJobs, cleanupNotification, clock),
    );

    const workers = await createTemporalWorker({
        address: config.temporal.address,
        namespace: config.temporal.namespace,
        taskQueue: JOB_TASK_QUEUE,
        activities: {
            prepareRecipeScan: recipe.prepareRecipeScan,
            finalizeRecipeScan: recipe.finalizeRecipeScan,
            markRecipeJobFailed: recipe.markRecipeJobFailed,
            prepareTitleSuggestion: title.prepareTitleSuggestion,
            finalizeTitleSuggestion: title.finalizeTitleSuggestion,
            markTitleJobFailed: title.markTitleJobFailed,
            prepareTaskCleanup: cleanup.prepareTaskCleanup,
            finalizeTaskCleanup: cleanup.finalizeTaskCleanup,
            markCleanupJobFailed: cleanup.markCleanupJobFailed,
        },
    });
    logInfo({ msg: "process.lifecycle.started", taskQueue: JOB_TASK_QUEUE });

    await runUntilShutdown({ workers, producer, dataSource });
}

await bootstrap().catch((error: unknown) => {
    logError({ msg: "process.bootstrap.failed", error: errorMessage(error) });
    process.exit(1);
});
