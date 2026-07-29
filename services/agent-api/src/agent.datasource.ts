import "reflect-metadata";
import type { DataSource } from "typeorm";
import { createDataSource, loadApplicationConfig } from "@tracer-agent/platform";

/** 에이전트 원장의 표를 TypeScript로 비추는 엔티티이며 스키마의 진실은 계약의 SQL이다. */
export const AGENT_ENTITIES = [] as const;

export function createAgentDataSource(): DataSource {
    return createDataSource({ db: loadApplicationConfig().agentDb, entities: [...AGENT_ENTITIES] });
}
