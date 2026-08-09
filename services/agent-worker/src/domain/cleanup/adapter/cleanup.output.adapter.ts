import { redactText } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import type { DataSource, EntityManager } from "typeorm";
import { CleanupSuggestionRowEntity } from "~agent-worker/config/ledger/cleanup.suggestion.entity.js";
import { CLEANUP_SUGGESTION_KIND_ARCHIVE } from "~agent-worker/domain/cleanup/model/cleanup.const.js";
import type {
    CleanupOutputPort,
    CleanupSuggestionBatch,
} from "~agent-worker/domain/cleanup/port/cleanup.output.port.js";
import type { CleanupObservedActivityPort } from "~agent-worker/domain/cleanup/port/cleanup.observed.activity.port.js";
import type { IdGeneratorPort } from "~agent-worker/support/id.generator.port.js";

/** 종결 단계가 적는 제안의 상태이며 해소는 사람이 뒤에 고른다. */
const PENDING_STATUS = "pending";

/** 제안 한 벌을 자기 원장의 한 커밋에 적으며 대기 행은 태스크와 종류마다 하나로 남는다. */
export class CleanupOutputAdapter implements CleanupOutputPort {
    constructor(
        private readonly dataSource: DataSource,
        private readonly ids: IdGeneratorPort,
        private readonly clock: IClock,
        private readonly observed: CleanupObservedActivityPort,
    ) {}

    async createSuggestions(batch: CleanupSuggestionBatch): Promise<number> {
        if (batch.suggestions.length === 0) return 0;
        const now = this.clock.now();
        // 느린 외부 호출을 트랜잭션 밖에 두어 한 요청이 원장 연결을 쥔 채 기다리지 않게 한다.
        const observedLastEventAt = await this.observed.lastEventAtByTask(
            batch.userId,
            batch.suggestions.map((suggestion) => suggestion.taskId),
        );
        return this.dataSource.transaction(async (manager) => {
            for (const suggestion of batch.suggestions) {
                await this.writeSuggestion(
                    manager,
                    batch,
                    suggestion.taskId,
                    redactText(suggestion.rationale),
                    observedLastEventAt.get(suggestion.taskId) ?? null,
                    now,
                );
            }
            return batch.suggestions.length;
        });
    }

    private async writeSuggestion(
        manager: EntityManager,
        batch: CleanupSuggestionBatch,
        taskId: string,
        rationale: string,
        observedLastEventAt: Date | null,
        now: Date,
    ): Promise<void> {
        const rows = manager.getRepository(CleanupSuggestionRowEntity);
        const standing = await rows.findOne({
            where: { userId: batch.userId, taskId, kind: CLEANUP_SUGGESTION_KIND_ARCHIVE, status: PENDING_STATUS },
        });
        if (standing !== null) {
            // 같은 태스크와 종류의 대기 행은 하나뿐이므로 새 근거와 새 관측 시각을 그 행에 겹쳐 적는다.
            await rows.update(
                { id: standing.id },
                { jobId: batch.jobId, rationale, observedLastEventAt },
            );
            return;
        }
        await rows.insert(newRow(this.ids.next(), batch, taskId, rationale, observedLastEventAt, now));
    }
}

function newRow(
    id: string,
    batch: CleanupSuggestionBatch,
    taskId: string,
    rationale: string,
    observedLastEventAt: Date | null,
    now: Date,
): CleanupSuggestionRowEntity {
    const row = new CleanupSuggestionRowEntity();
    row.id = id;
    row.userId = batch.userId;
    row.jobId = batch.jobId;
    row.taskId = taskId;
    row.kind = CLEANUP_SUGGESTION_KIND_ARCHIVE;
    row.currentValue = null;
    row.proposedValue = null;
    // 모델이 지은 글이 사용자에게 닿기 전 자리이므로 계약의 output 단계를 여기서 지난다.
    row.rationale = rationale;
    row.status = PENDING_STATUS;
    row.error = null;
    row.createdAt = now;
    row.resolvedAt = null;
    row.observedLastEventAt = observedLastEventAt;
    return row;
}
