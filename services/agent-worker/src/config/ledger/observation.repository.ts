import type { AgentRunObservation } from "@tracer-agent/llm";
import type { QueryDeepPartialEntity, Repository } from "typeorm";
import {
    AgentRunObservationEntity,
    toAgentRunObservationRow,
} from "./agent.run.observation.entity.js";

/** 실행 관측을 원장에 한 번만 기록하며 같은 시도가 다시 오면 덮지 않는다. */
export class TypeOrmAgentRunObservationRepository {
    constructor(private readonly repo: Repository<AgentRunObservationEntity>) {}

    async record(userId: string, observation: AgentRunObservation, now: Date): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .insert()
            .into(AgentRunObservationEntity)
            .values(
                toAgentRunObservationRow(userId, observation, now) as unknown as
                    QueryDeepPartialEntity<AgentRunObservationEntity>,
            )
            .orIgnore()
            .execute();
        return (result.identifiers[0] ?? null) !== null;
    }
}
