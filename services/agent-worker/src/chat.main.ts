import "reflect-metadata";
import { assertTraceEnvironment, ClaudeQueryRunner } from "@tracer-agent/llm";
import {
    createDataSource,
    errorMessage,
    loadApplicationConfig,
    logError,
    logInfo,
    SystemClock,
} from "@tracer-agent/platform";
import { TracerApiClient } from "@tracer-agent/tracer-client";
import { createChatTemporalWorker } from "~agent-worker/config/chat.temporal.worker.js";
import { createKafka } from "~agent-worker/config/kafka.factory.js";
import { CHAT_EXECUTION_TASK_QUEUE } from "~agent-worker/config/queue.const.js";
import { resolveAgentApiUrl, resolveTracerApiUrl } from "~agent-worker/config/service.url.js";
import { ChatAgentAdapter } from "~agent-worker/domain/chat/adapter/chat.agent.adapter.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { ContractPromptSource } from "~agent-worker/support/contract.prompt.source.js";
import { AgentRunObservationEntity } from "~agent-worker/config/ledger/agent.run.observation.entity.js";
import {
    ChatExecutionEntity,
    ChatMessageEntity,
    ChatThreadEntity,
} from "~agent-worker/domain/chat/adapter/chat.entity.js";
import { ChatExecutionSinkFactory } from "~agent-worker/domain/chat/adapter/chat.execution.sink.js";
import { ChatExecutionStepEntity } from "~agent-worker/domain/chat/adapter/chat.execution.step.entity.js";
import { ChatExecutionUpdatePublisher } from "~agent-worker/domain/chat/adapter/chat.execution.update.publisher.js";
import { ChatReplayClient } from "~agent-worker/domain/chat/adapter/chat.replay.client.js";
import { ChatScheduler } from "~agent-worker/domain/chat/adapter/chat.scheduler.js";
import { ChatSettingReaderAdapter } from "~agent-worker/domain/chat/adapter/chat.setting.reader.adapter.js";
import { ChatSummarizerAdapter } from "~agent-worker/domain/chat/adapter/chat.summarizer.adapter.js";
import {
    ChatDraftTokenAdapter,
    ChatScopeTokenAdapter,
} from "~agent-worker/domain/chat/adapter/chat.token.adapter.js";
import { ChatTransactionAdapter } from "~agent-worker/domain/chat/adapter/chat.transaction.adapter.js";
import { ChatUlidGenerator } from "~agent-worker/domain/chat/adapter/chat.ulid.generator.js";
import { TypeOrmChatExecutionRepository } from "~agent-worker/domain/chat/adapter/typeorm.chat.execution.repository.adapter.js";
import {
    TypeOrmChatMessageRepository,
    TypeOrmChatThreadRepository,
} from "~agent-worker/domain/chat/adapter/typeorm.chat.repository.adapter.js";
import { FailChatExecutionUsecase } from "~agent-worker/domain/chat/application/fail.chat.execution.usecase.js";
import { FinalizeChatExecutionUsecase } from "~agent-worker/domain/chat/application/finalize.chat.execution.usecase.js";
import { GenerateChatExecutionUsecase } from "~agent-worker/domain/chat/application/generate.chat.execution.usecase.js";
import { GenerateThreadTitleProjection } from "~agent-worker/domain/chat/application/generate.thread.title.projection.js";
import { GetNextChatExecutionUsecase } from "~agent-worker/domain/chat/application/get.next.chat.execution.usecase.js";
import { PrepareChatExecutionUsecase } from "~agent-worker/domain/chat/application/prepare.chat.execution.usecase.js";
import { SummarizeThreadProjection } from "~agent-worker/domain/chat/application/summarize.thread.projection.js";
import { ChatExecutionActivity } from "~agent-worker/domain/chat/inbound/chat.execution.activity.js";

/** 대화 원장의 표를 비추는 엔티티이며 스키마의 진실은 계약의 SQL이다. */
const CHAT_ENTITIES = [
    ChatThreadEntity,
    ChatMessageEntity,
    ChatExecutionEntity,
    ChatExecutionStepEntity,
    AgentRunObservationEntity,
] as const;

// 배포가 진행 중인 언어 모델 호출을 끝까지 기다린 뒤에 프로세스를 내린다.
const SHUTDOWN_TIMEOUT_MS = 370_000;

async function bootstrap(): Promise<void> {
    assertTraceEnvironment();
    const config = loadApplicationConfig();
    const dataSource = createDataSource({ db: config.agentDb, entities: [...CHAT_ENTITIES] });
    await dataSource.initialize();

    const producer = createKafka("agent-worker-chat").producer();
    await producer.connect();
    const clock = new SystemClock();
    const executions = new TypeOrmChatExecutionRepository(dataSource.getRepository(ChatExecutionEntity));
    const threads = new TypeOrmChatThreadRepository(dataSource.getRepository(ChatThreadEntity));
    const messages = new TypeOrmChatMessageRepository(dataSource.getRepository(ChatMessageEntity));
    const settings = new ChatSettingReaderAdapter(dataSource);
    const transaction = new ChatTransactionAdapter(dataSource);

    const isLocal = config.profile === "local";
    const runner = new ClaudeQueryRunner(isLocal, isLocal);
    const tracerApi = new TracerApiClient(resolveTracerApiUrl());
    const agentApiBaseUrl = resolveAgentApiUrl(config.agentApi.port);
    // 장기기억 원장은 에이전트 서비스가 소유하므로 계약이 선언한 같은 경로를 이 기점으로 부른다.
    const memoryApi = new TracerApiClient(agentApiBaseUrl);
    const agent = new ChatAgentAdapter(
        runner,
        tracerApi,
        memoryApi,
        agentApiBaseUrl,
        new ContractPromptSource(AGENT.chat.id),
    );
    const summarizer = new ChatSummarizerAdapter(new ClaudeQueryRunner(isLocal, isLocal));
    const scheduler = new ChatScheduler();
    const events = new ChatExecutionUpdatePublisher(producer);
    const sinks = new ChatExecutionSinkFactory(executions, clock, scheduler, events);
    const ids = new ChatUlidGenerator(clock);
    const replayClients = (userId: string, scopeToken: string | undefined): ChatReplayClient =>
        new ChatReplayClient(agentApiBaseUrl, userId, scopeToken);

    const activity = new ChatExecutionActivity(
        new PrepareChatExecutionUsecase(executions, threads, clock, events),
        new GenerateChatExecutionUsecase(
            agent,
            settings,
            sinks,
            executions,
            new ChatDraftTokenAdapter(),
            new ChatScopeTokenAdapter(),
            clock,
            scheduler,
            replayClients,
        ),
        new FinalizeChatExecutionUsecase(
            executions,
            threads,
            messages,
            transaction,
            clock,
            ids,
            events,
            new SummarizeThreadProjection(threads, summarizer, clock, settings),
            new GenerateThreadTitleProjection(threads, summarizer, clock, settings),
        ),
        new FailChatExecutionUsecase(executions, clock, events),
        new GetNextChatExecutionUsecase(executions),
    );

    const worker = await createChatTemporalWorker({
        address: config.temporal.address,
        namespace: config.temporal.namespace,
        taskQueue: CHAT_EXECUTION_TASK_QUEUE,
        activities: {
            prepareChatExecution: activity.prepareChatExecution,
            generateChatExecution: activity.generateChatExecution,
            finalizeChatExecution: activity.finalizeChatExecution,
            failChatExecution: activity.failChatExecution,
            getNextChatExecution: activity.getNextChatExecution,
        },
    });
    logInfo({ msg: "process.lifecycle.started", taskQueue: CHAT_EXECUTION_TASK_QUEUE });

    let shuttingDown = false;
    const shutdown = (signal: NodeJS.Signals): void => {
        if (shuttingDown) return;
        shuttingDown = true;
        logInfo({ msg: "process.lifecycle.stopping", signal });
        worker.shutdown();
    };
    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
    try {
        await worker.run();
    } finally {
        const forceExit = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
        forceExit.unref();
        await worker.close();
        await producer.disconnect().catch(() => undefined);
        await dataSource.destroy();
        clearTimeout(forceExit);
    }
}

await bootstrap().catch((error: unknown) => {
    logError({ msg: "process.bootstrap.failed", error: errorMessage(error) });
    process.exit(1);
});
