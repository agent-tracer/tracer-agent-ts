import type { Repository } from "typeorm";
import { upsertByKeys } from "~agent-api/config/typeorm.upsert.js";
import type { CleanupSuggestionStatus } from "~agent-api/domain/cleanup/model/cleanup.const.js";
import type { CleanupSuggestion } from "~agent-api/domain/cleanup/model/cleanup.suggestion.model.js";
import type { CleanupSuggestionRepositoryPort } from "~agent-api/domain/cleanup/port/cleanup.repository.port.js";
import {
    toCleanupSuggestion,
    toCleanupSuggestionRow,
    type CleanupSuggestionEntity,
} from "./cleanup.suggestion.entity.js";

export class TypeOrmCleanupSuggestionRepository implements CleanupSuggestionRepositoryPort {
    constructor(private readonly repo: Repository<CleanupSuggestionEntity>) {}

    async findById(id: string): Promise<CleanupSuggestion | null> {
        const row = await this.repo.findOne({ where: { id } });
        return row === null ? null : toCleanupSuggestion(row);
    }

    async findByUserStatus(userId: string, status: CleanupSuggestionStatus): Promise<CleanupSuggestion[]> {
        const rows = await this.repo.find({ where: { userId, status }, order: { createdAt: "DESC" } });
        return rows.map(toCleanupSuggestion);
    }

    async upsert(suggestion: CleanupSuggestion): Promise<void> {
        await upsertByKeys(this.repo, toCleanupSuggestionRow(suggestion), ["id"]);
    }
}
