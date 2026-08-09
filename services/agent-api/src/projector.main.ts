import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { errorMessage, logError, logInfo } from "@tracer-agent/platform";
import { createKafka } from "~agent-api/config/kafka.factory.js";
import { SearchOutboxDrainScheduler } from "~agent-api/domain/recipe/adapter/search.outbox.drain.scheduler.js";
import { EnsureRecipeIndexUseCase } from "~agent-api/domain/recipe/application/ensure.recipe.index.usecase.js";
import { SearchOutboxDrainUseCase } from "~agent-api/domain/recipe/application/search.outbox.drain.usecase.js";
import { LedgerEventConsumer, RecipeProjection } from "./recipe.feature.js";
import { AgentProjectorModule } from "./agent.projector.module.js";
import { createAgentDataSource } from "./agent.datasource.js";
import { readContractVersion } from "./support/contract.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function bootstrap(): Promise<void> {
    // 스키마 적용은 배포의 선행 스텝이 소유하고 부트는 원장에 붙기만 한다.
    const dataSource = createAgentDataSource();
    await dataSource.initialize();

    const app = await NestFactory.createApplicationContext(
        AgentProjectorModule.forRoot(dataSource),
        { logger: ["error", "warn"] },
    );

    // 색인 없이 배출이 먼저 돌면 OpenSearch 가 분석기 없는 색인을 자동으로 만들고 검색이 조용히 갈린다.
    await app.get(EnsureRecipeIndexUseCase).execute();

    const kafka = createKafka("agent-projector");
    // 적용 이력은 HTTP 로만 채워지지 않으므로 추적이 소유한 사건 스트림을 자기 그룹으로 읽는다.
    const ledgerEvents = new LedgerEventConsumer(kafka, app.get(RecipeProjection));
    await ledgerEvents.start();

    const searchOutbox = new SearchOutboxDrainScheduler(app.get(SearchOutboxDrainUseCase));
    searchOutbox.start();

    logInfo({ msg: "process.lifecycle.started", contract: readContractVersion() });

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
