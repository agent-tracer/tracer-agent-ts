import { redactText } from "@tracer-agent/llm";
import type { TracerApiWindow } from "@tracer-agent/tracer-client";
import { wireArray, wireObject } from "~agent-worker/support/wire.value.js";
import { CLEANUP_SUGGESTION_KIND_ARCHIVE } from "~agent-worker/domain/cleanup/model/cleanup.const.js";
import type {
    CleanupOutputPort,
    CleanupSuggestionBatch,
} from "~agent-worker/domain/cleanup/port/cleanup.output.port.js";

/** 제안 한 벌을 추적 API의 산출물 창구로 보내며 그 창구가 한 트랜잭션으로 쓴다. */
export class CleanupOutputAdapter implements CleanupOutputPort {
    constructor(private readonly tracer: TracerApiWindow) {}

    async createSuggestions(batch: CleanupSuggestionBatch): Promise<number> {
        if (batch.suggestions.length === 0) return 0;
        const created = await this.tracer.request({
            method: "POST",
            path: "/api/v1/task-cleanup/suggestions",
            userId: batch.userId,
            body: {
                suggestions: batch.suggestions.map((suggestion) => ({
                    taskId: suggestion.taskId,
                    kind: CLEANUP_SUGGESTION_KIND_ARCHIVE,
                    // 모델이 지은 글이 사용자에게 닿기 전 자리이므로 계약의 output 단계를 여기서 지난다.
                    rationale: redactText(suggestion.rationale),
                })),
                jobId: batch.jobId,
            },
        });
        return wireArray(wireObject(created)["suggestions"]).length;
    }
}
