import "reflect-metadata";
import { errorMessage, logError } from "@tracer-agent/platform";
import { applyContractSchema } from "~agent-api/config/schema.runner.js";
import { createAgentDataSource } from "./agent.datasource.js";

// 스키마 적용은 배포의 선행 스텝이 소유하며 프로세스 기동과 분리되어 있다.
const dataSource = createAgentDataSource();
try {
    await dataSource.initialize();
    await applyContractSchema(dataSource);
} catch (error) {
    logError({ msg: "schema.contract.failed", error: errorMessage(error) });
    process.exitCode = 1;
} finally {
    await dataSource.destroy().catch(() => undefined);
}
