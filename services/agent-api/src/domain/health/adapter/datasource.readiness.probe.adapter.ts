import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import type { ReadinessProbe } from "~agent-api/domain/health/port/readiness.probe.port.js";

/** 준비성 점검을 에이전트 원장 DataSource의 왕복 질의로 수행한다. */
@Injectable()
export class DataSourceReadinessProbeAdapter implements ReadinessProbe {
    constructor(@Inject(AGENT_DATA_SOURCE) private readonly dataSource: DataSource) {}

    async ping(): Promise<void> {
        await this.dataSource.query("SELECT 1");
    }
}
