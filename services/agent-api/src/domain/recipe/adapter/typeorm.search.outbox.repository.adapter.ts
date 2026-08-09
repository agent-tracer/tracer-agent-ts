import type { Repository } from "typeorm";
import { upsertByKeys } from "~agent-api/config/typeorm.upsert.js";
import type { SearchOutboxRow } from "~agent-api/domain/recipe/model/search.outbox.model.js";
import type { SearchOutboxWriterPort } from "~agent-api/domain/recipe/port/recipe.transaction.port.js";
import type { SearchOutboxDrainRepositoryPort } from "~agent-api/domain/recipe/port/search.outbox.drain.port.js";
import { toSearchOutboxEntity, toSearchOutboxRow, type SearchOutboxEntity } from "./search.outbox.entity.js";

/** 색인 반영 요청을 적재하고 배출기가 읽고 지우는 자리를 한 저장소가 갖는다. */
export class TypeOrmSearchOutboxRepository implements SearchOutboxWriterPort, SearchOutboxDrainRepositoryPort {
    constructor(private readonly repo: Repository<SearchOutboxEntity>) {}

    async enqueue(row: SearchOutboxRow): Promise<void> {
        await upsertByKeys(this.repo, toSearchOutboxEntity(row), ["id"]);
    }

    /** 오래된 것부터 배출해 색인이 원장의 순서를 따라간다. */
    async findBatch(limit: number): Promise<SearchOutboxRow[]> {
        const rows = await this.repo.find({ order: { createdAt: "ASC" }, take: limit });
        return rows.map(toSearchOutboxRow);
    }

    async delete(id: string): Promise<void> {
        await this.repo.delete({ id });
    }

    /** 실패한 행은 남겨 다음 주기가 다시 집으며 사유를 적어 반복 실패를 관측할 수 있게 한다. */
    async markFailed(id: string, attempts: number, error: string): Promise<void> {
        await this.repo.update({ id }, { attempts, lastError: error });
    }
}
