import "reflect-metadata";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { errorMessage, loadApplicationConfig, logError, logInfo } from "@tracer-agent/platform";
import { createKafka } from "~agent-api/config/kafka.factory.js";
import { ChatExecutionEvents } from "~agent-api/domain/chat/adapter/chat.execution.events.js";
import { ChatExecutionUpdateConsumer } from "~agent-api/domain/chat/adapter/chat.execution.update.consumer.js";
import { SearchOutboxDrainScheduler } from "~agent-api/domain/recipe/adapter/search.outbox.drain.scheduler.js";
import { SearchOutboxDrainUseCase } from "~agent-api/domain/recipe/application/search.outbox.drain.usecase.js";
import { LedgerEventConsumer, RecipeProjection } from "./recipe.feature.js";
import { AgentApiModule } from "./agent.api.module.js";
import { createAgentDataSource } from "./agent.datasource.js";
import { readContractVersion } from "./support/contract.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function bootstrap(): Promise<void> {
    const config = loadApplicationConfig();
    // 스키마 적용은 배포의 선행 스텝이 소유하고 부트는 원장에 붙기만 한다.
    const dataSource = createAgentDataSource();
    await dataSource.initialize();

    const kafka = createKafka("agent-api");
    const app = await NestFactory.create<NestExpressApplication>(
        AgentApiModule.forRoot(dataSource, kafka),
        { logger: ["error", "warn"] },
    );
    app.use(helmet());

    const updates = new ChatExecutionUpdateConsumer(kafka, app.get(ChatExecutionEvents));
    await updates.start();

    // 적용 이력은 HTTP 로만 채워지지 않으므로 추적이 소유한 사건 스트림을 자기 그룹으로 읽는다.
    const ledgerEvents = new LedgerEventConsumer(kafka, app.get(RecipeProjection));
    await ledgerEvents.start();

    const searchOutbox = new SearchOutboxDrainScheduler(app.get(SearchOutboxDrainUseCase));
    searchOutbox.start();

    const host = config.listenHost;
    const { port } = config.agentApi;
    await app.listen(port, host);
    logInfo({ msg: "process.lifecycle.started", host, port, contract: readContractVersion() });

    let shuttingDown = false;
    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
        if (shuttingDown) return;
        shuttingDown = true;
        logInfo({ msg: "process.lifecycle.stopping", signal });

        const forceExit = setTimeout(() => {
            logError({ msg: "process.shutdown.timed_out" });
            process.exit(1);
        }, SHUTDOWN_TIMEOUT_MS);
        forceExit.unref();
        try {
            searchOutbox.stop();
            await ledgerEvents.stop();
            await updates.stop();
            await app.close();
            await dataSource.destroy();
            process.exit(0);
        } catch (error) {
            logError({ msg: "process.shutdown.failed", error: errorMessage(error) });
            process.exit(1);
        }
    };
    process.once("SIGTERM", () => void shutdown("SIGTERM"));
    process.once("SIGINT", () => void shutdown("SIGINT"));
}

await bootstrap().catch((error: unknown) => {
    logError({ msg: "process.bootstrap.failed", error: errorMessage(error) });
    process.exit(1);
});
