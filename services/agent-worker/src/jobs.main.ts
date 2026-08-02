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
import { createKafka } from "~agent-worker/config/kafka.factory.js";
import { createNotificationPublisher } from "~agent-worker/config/notification.js";
import { resolveTracerApiUrl } from "~agent-worker/config/service.url.js";
import { JOB_TASK_QUEUE } from "~agent-worker/config/queue.const.js";
import { createTemporalWorker } from "~agent-worker/config/temporal.worker.js";
import { runUntilShutdown } from "~agent-worker/config/worker.lifecycle.js";
import { RecipeNotificationAdapter } from "~agent-worker/domain/recipe/adapter/recipe.notification.adapter.js";
import { RecipeOutputAdapter } from "~agent-worker/domain/recipe/adapter/recipe.output.adapter.js";
import { RecipeReaderAdapter } from "~agent-worker/domain/recipe/adapter/recipe.reader.adapter.js";
import { RecipeSearchAdapter } from "~agent-worker/domain/recipe/adapter/recipe.search.adapter.js";
import { RecipeRepositoryAdapter } from "~agent-worker/domain/recipe/adapter/recipe.repository.adapter.js";
import { RecipeAgentAdapter } from "~agent-worker/domain/recipe/adapter/recipe.agent.adapter.js";
import { RecipeStageOutputAdapter } from "~agent-worker/domain/recipe/adapter/recipe.stage.output.adapter.js";
import { RunRecipeStageUsecase } from "~agent-worker/domain/recipe/application/run.recipe.stage.usecase.js";
import { ContractPromptSourceAdapter as RecipePromptSourceAdapter } from "~agent-worker/domain/recipe/adapter/contract.prompt.source.adapter.js";
import { RecipeUlidGenerator } from "~agent-worker/domain/recipe/adapter/recipe.ulid.generator.js";
import { FailRecipeJobUsecase } from "~agent-worker/domain/recipe/application/fail.recipe.job.usecase.js";
import { FinalizeRecipeScanUsecase } from "~agent-worker/domain/recipe/application/finalize.recipe.scan.usecase.js";
import { PrepareRecipeScanUsecase } from "~agent-worker/domain/recipe/application/prepare.recipe.scan.usecase.js";
import { ScanRecipeUsecase } from "~agent-worker/domain/recipe/application/scan.recipe.usecase.js";
import { RecipeActivity } from "~agent-worker/domain/recipe/inbound/recipe.activity.js";
import { CleanupNotificationAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.notification.adapter.js";
import { CleanupOutputAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.output.adapter.js";
import { CleanupReaderAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.reader.adapter.js";
import { CleanupRepositoryAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.repository.adapter.js";
import { CleanupSdkAgentAdapter } from "~agent-worker/domain/cleanup/adapter/cleanup.sdk.agent.adapter.js";
import { CleanupUlidGenerator } from "~agent-worker/domain/cleanup/adapter/cleanup.ulid.generator.js";
import { FailCleanupJobUsecase } from "~agent-worker/domain/cleanup/application/fail.cleanup.job.usecase.js";
import { FinalizeTaskCleanupUsecase } from "~agent-worker/domain/cleanup/application/finalize.task.cleanup.usecase.js";
import { PrepareTaskCleanupUsecase } from "~agent-worker/domain/cleanup/application/prepare.task.cleanup.usecase.js";
import { ContractPromptSourceAdapter as CleanupPromptSourceAdapter } from "~agent-worker/domain/cleanup/adapter/contract.prompt.source.adapter.js";
import { SuggestCleanupUsecase } from "~agent-worker/domain/cleanup/application/suggest.cleanup.usecase.js";
import { CleanupActivity } from "~agent-worker/domain/cleanup/inbound/cleanup.activity.js";
import { TitleNotificationAdapter } from "~agent-worker/domain/title/adapter/title.notification.adapter.js";
import { TitleEventReaderAdapter } from "~agent-worker/domain/title/adapter/title.event.reader.adapter.js";
import { TitleRepositoryAdapter } from "~agent-worker/domain/title/adapter/title.repository.adapter.js";
import { TitleAgentAdapter } from "~agent-worker/domain/title/adapter/title.agent.adapter.js";
import { ContractPromptSourceAdapter as TitlePromptSourceAdapter } from "~agent-worker/domain/title/adapter/contract.prompt.source.adapter.js";
import { TitleUlidGenerator } from "~agent-worker/domain/title/adapter/title.ulid.generator.js";
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

    const recipeIds = new RecipeUlidGenerator();
    const recipeReader = new RecipeReaderAdapter(tracer);
    const recipeSearch = new RecipeSearchAdapter(tracer);
    const recipeRepository = new RecipeRepositoryAdapter(dataSource, tracer);
    const recipeOutput = new RecipeOutputAdapter(tracer);
    const recipeNotification = new RecipeNotificationAdapter(publish);
    const recipePrompts = new RecipePromptSourceAdapter();
    const recipeStageOutputs = new RecipeStageOutputAdapter(dataSource);
    const recipeStages = new RunRecipeStageUsecase(recipeStageOutputs, clock);
    const recipeAgent = new RecipeAgentAdapter(claudeRunner, {
        tasks: recipeReader,
        events: recipeReader,
        rules: recipeReader,
        search: recipeSearch,
    }, recipePrompts, recipeStages);
    const recipe = new RecipeActivity(
        new PrepareRecipeScanUsecase(recipeRepository, recipeAgent, recipeNotification, clock, recipePrompts),
        new ScanRecipeUsecase(recipeRepository, recipeAgent, clock, recipeIds),
        new FinalizeRecipeScanUsecase(
            recipeRepository,
            recipeOutput,
            recipeNotification,
            clock,
            recipeStageOutputs,
        ),
        new FailRecipeJobUsecase(recipeRepository, recipeNotification, clock, recipeStageOutputs),
    );

    const titleIds = new TitleUlidGenerator(clock);
    const titleReader = new TitleEventReaderAdapter(tracer);
    const titleRepository = new TitleRepositoryAdapter(dataSource, tracer);
    const titleNotification = new TitleNotificationAdapter(publish);
    const titlePrompts = new TitlePromptSourceAdapter();
    const titleAgent = new TitleAgentAdapter(claudeRunner, titleReader, titlePrompts);
    const title = new TitleActivity(
        new PrepareTitleSuggestionUsecase(titleRepository, titleAgent, titleNotification, clock, titlePrompts),
        new SuggestTitleUsecase(titleRepository, titleAgent, clock, titleIds),
        new FinalizeTitleSuggestionUsecase(titleRepository, titleNotification, clock),
        new FailTitleJobUsecase(titleRepository, titleNotification, clock),
    );

    const cleanupIds = new CleanupUlidGenerator();
    const cleanupReader = new CleanupReaderAdapter(tracer);
    const cleanupRepository = new CleanupRepositoryAdapter(dataSource, tracer);
    const cleanupOutput = new CleanupOutputAdapter(tracer);
    const cleanupNotification = new CleanupNotificationAdapter(publish);
    const cleanupPrompts = new CleanupPromptSourceAdapter();
    const cleanupAgent = new CleanupSdkAgentAdapter(claudeRunner, {
        tasks: cleanupReader,
        events: cleanupReader,
    }, cleanupPrompts);
    const cleanup = new CleanupActivity(
        new PrepareTaskCleanupUsecase(cleanupRepository, cleanupAgent, cleanupNotification, clock, cleanupPrompts),
        new SuggestCleanupUsecase(cleanupRepository, cleanupAgent, clock, cleanupIds),
        new FinalizeTaskCleanupUsecase(cleanupRepository, cleanupOutput, cleanupNotification, clock),
        new FailCleanupJobUsecase(cleanupRepository, cleanupNotification, clock),
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
