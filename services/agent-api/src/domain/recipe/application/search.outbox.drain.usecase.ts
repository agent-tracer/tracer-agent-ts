import { Inject, Injectable } from "@nestjs/common";
import { errorMessage, logError, logInfo } from "@tracer-agent/platform";
import {
    buildRecipeDocument,
    RECIPES_INDEX_ALIAS,
    SEARCH_OUTBOX_BATCH_SIZE,
} from "~agent-api/domain/recipe/model/recipe.document.js";
import type { SearchOutboxRow } from "~agent-api/domain/recipe/model/search.outbox.model.js";
import {
    SEARCH_INDEX_WRITER,
    SEARCH_OUTBOX_DRAIN,
    type SearchIndexWriterPort,
    type SearchOutboxDrainPort,
    type SearchOutboxDrainRepositories,
    type SearchOutboxDrainRunnerPort,
} from "~agent-api/domain/recipe/port/search.outbox.drain.port.js";

/** 원장 쓰기와 같은 커밋에 적재된 색인 반영 요청을 주기마다 배출한다. */
@Injectable()
export class SearchOutboxDrainUseCase implements SearchOutboxDrainRunnerPort {
    constructor(
        @Inject(SEARCH_OUTBOX_DRAIN) private readonly drain: SearchOutboxDrainPort,
        @Inject(SEARCH_INDEX_WRITER) private readonly searchIndex: SearchIndexWriterPort,
    ) {}

    async runOnce(): Promise<number> {
        const drained = await this.drain.withLock((repositories) => this.drainBatch(repositories));
        if (drained === null) {
            logInfo({ msg: "search.outbox_drain.skipped", reason: "lock_not_acquired" });
            return 0;
        }
        if (drained > 0) logInfo({ msg: "search.outbox_drain.completed", count: drained });
        return drained;
    }

    private async drainBatch(repositories: SearchOutboxDrainRepositories): Promise<number> {
        const rows = await repositories.searchOutbox.findBatch(SEARCH_OUTBOX_BATCH_SIZE);
        let applied = 0;
        for (const row of rows) {
            if (await this.apply(row, repositories)) {
                await repositories.searchOutbox.delete(row.id);
                applied += 1;
                continue;
            }
            await repositories.searchOutbox.markFailed(row.id, row.attempts + 1, "search index write failed");
        }
        return applied;
    }

    /** 지운 레시피는 조회에 잡히지 않으므로 없는 것과 지워야 할 것을 구분하지 않는다. */
    private async apply(row: SearchOutboxRow, repositories: SearchOutboxDrainRepositories): Promise<boolean> {
        try {
            const recipe = await repositories.recipes.findById(row.targetId);
            if (recipe === null) {
                await this.searchIndex.deleteDocument(RECIPES_INDEX_ALIAS, row.targetId);
                return true;
            }
            await this.searchIndex.indexDocument(RECIPES_INDEX_ALIAS, recipe.id, buildRecipeDocument(recipe));
            return true;
        } catch (error) {
            logError({
                msg: "search.outbox_drain.failed",
                target: row.target,
                targetId: row.targetId,
                attempts: row.attempts,
                error: errorMessage(error),
            });
            return false;
        }
    }
}
