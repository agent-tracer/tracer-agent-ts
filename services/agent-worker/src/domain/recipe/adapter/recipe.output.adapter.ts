import { redactPayload } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import type { DataSource, EntityManager } from "typeorm";
import { RecipeRowEntity } from "~agent-worker/config/ledger/recipe.entity.js";
import {
    SEARCH_OUTBOX_TARGET_RECIPE,
    SearchOutboxRowEntity,
} from "~agent-worker/config/ledger/search.outbox.entity.js";
import { RECIPE_AUTHOR_AGENT } from "~agent-worker/domain/recipe/model/recipe.const.js";
import type { GeneratedRecipeCandidate } from "~agent-worker/domain/recipe/model/recipe.candidate.model.js";
import type {
    RecipeCandidateBatch,
    RecipeOutputPort,
} from "~agent-worker/domain/recipe/port/recipe.output.port.js";
import type { IdGeneratorPort } from "~agent-worker/support/id.generator.port.js";

/** 종결 단계가 적는 후보의 상태이며 채택은 사람이 뒤에 고른다. */
const CANDIDATE_STATUS = "candidate";

/** 후보 한 벌과 그 색인 적재를 자기 원장의 한 커밋에 적는다. */
export class RecipeOutputAdapter implements RecipeOutputPort {
    constructor(
        private readonly dataSource: DataSource,
        private readonly ids: IdGeneratorPort,
        private readonly clock: IClock,
    ) {}

    async createCandidates(batch: RecipeCandidateBatch): Promise<number> {
        if (batch.recipes.length === 0) return 0;
        const now = this.clock.now();
        return this.dataSource.transaction(async (manager) => {
            // 같은 실행이 여러 번 시도돼도 후보가 두 벌이 되지 않는다.
            const written = await manager.getRepository(RecipeRowEntity).countBy({
                userId: batch.userId,
                sourceJobId: batch.sourceJobId,
            });
            if (written > 0) return written;
            for (const candidate of batch.recipes) {
                await this.writeCandidate(manager, batch, candidate, now);
            }
            return batch.recipes.length;
        });
    }

    private async writeCandidate(
        manager: EntityManager,
        batch: RecipeCandidateBatch,
        candidate: GeneratedRecipeCandidate,
        now: Date,
    ): Promise<void> {
        const parent = await this.readOwnedParent(manager, batch.userId, candidate);
        const row = toRow(this.ids.next(), batch, candidate, parent, now);
        await manager.getRepository(RecipeRowEntity).save(row);
        await manager.getRepository(SearchOutboxRowEntity).save(outboxRow(this.ids.next(), batch.userId, row.id, now));
    }

    /** 부모가 이 사용자의 것이고 관측한 판을 여전히 가리킬 때만 개정으로 이어 붙인다. */
    private async readOwnedParent(
        manager: EntityManager,
        userId: string,
        candidate: GeneratedRecipeCandidate,
    ): Promise<RecipeRowEntity | null> {
        if (candidate.parentRecipeId === undefined || candidate.parentRecipeSeenRev === undefined) return null;
        const parent = await manager.getRepository(RecipeRowEntity).findOne({
            where: { id: candidate.parentRecipeId },
        });
        if (parent === null || parent.userId !== userId) return null;
        return parent.rev === candidate.parentRecipeSeenRev ? parent : null;
    }
}

function outboxRow(id: string, userId: string, recipeId: string, now: Date): SearchOutboxRowEntity {
    const row = new SearchOutboxRowEntity();
    row.id = id;
    row.userId = userId;
    row.target = SEARCH_OUTBOX_TARGET_RECIPE;
    row.targetId = recipeId;
    row.attempts = 0;
    row.lastError = null;
    row.createdAt = now;
    return row;
}

function toRow(
    id: string,
    batch: RecipeCandidateBatch,
    candidate: GeneratedRecipeCandidate,
    parent: RecipeRowEntity | null,
    now: Date,
): RecipeRowEntity {
    // 모델이 지은 글이 사용자에게 닿기 전 자리이므로 계약의 output 단계를 여기서 지난다.
    const redacted = redactPayload(candidate) as GeneratedRecipeCandidate;
    const row = new RecipeRowEntity();
    row.id = id;
    row.userId = batch.userId;
    row.status = CANDIDATE_STATUS;
    row.title = redacted.title;
    row.intent = redacted.intent;
    row.description = redacted.description;
    row.useWhen = [...redacted.useWhen];
    row.summaryMd = redacted.summaryMd;
    row.request = redacted.request;
    row.inputs = [...redacted.inputs];
    row.outputs = [...redacted.outputs];
    row.corrections = [...redacted.corrections];
    row.pitfalls = [...redacted.pitfalls];
    row.recovery = [...redacted.recovery];
    row.governingRules = [...redacted.governingRules];
    row.steps = [...redacted.steps];
    row.touchedFiles = [...redacted.touchedFiles];
    row.contributingSlices = [...redacted.contributingSlices];
    row.rationale = redacted.rationale;
    row.language = batch.language;
    row.rev = parent !== null ? parent.rev + 1 : 1;
    row.parentRecipeId = parent !== null ? parent.id : null;
    row.sourceJobId = batch.sourceJobId;
    row.userEdited = false;
    row.lastEditedBy = RECIPE_AUTHOR_AGENT;
    row.error = null;
    row.createdAt = now;
    row.updatedAt = now;
    row.resolvedAt = null;
    row.deletedAt = null;
    return row;
}
