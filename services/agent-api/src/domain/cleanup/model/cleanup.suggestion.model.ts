import {
    CLEANUP_SUGGESTION_STATUS,
    type CleanupSuggestionKind,
    type CleanupSuggestionStatus,
} from "~agent-api/domain/cleanup/model/cleanup.const.js";
import { CleanupNotPendingError } from "~agent-api/domain/cleanup/model/cleanup.errors.js";

/** 정리 제안 원장 행 하나이며 수용은 자기 원장에 적고 판정은 추적이 갖는다. */
export class CleanupSuggestion {
    id!: string;

    userId!: string;

    jobId!: string;

    taskId!: string;

    kind!: CleanupSuggestionKind;

    currentValue!: string | null;

    proposedValue!: string | null;

    rationale!: string;

    status!: CleanupSuggestionStatus;

    error!: string | null;

    createdAt!: Date;

    resolvedAt!: Date | null;

    /** 제안이 관측한 그 태스크의 마지막 사건 시각이며 수용이 조건으로 실어 보낸다. */
    observedLastEventAt!: Date | null;

    isOwnedBy(userId: string): boolean {
        return this.userId === userId;
    }

    isAccepted(): boolean {
        return this.status === CLEANUP_SUGGESTION_STATUS.accepted;
    }

    accept(now: Date): void {
        if (this.status !== CLEANUP_SUGGESTION_STATUS.pending) throw new CleanupNotPendingError();
        this.status = CLEANUP_SUGGESTION_STATUS.accepted;
        this.resolvedAt = now;
    }

    /** 추적이 조건이 깨졌다고 알리면 수용을 되돌려 대기로 남긴다. */
    revertAcceptance(): void {
        this.status = CLEANUP_SUGGESTION_STATUS.pending;
        this.resolvedAt = null;
    }

    dismiss(now: Date): void {
        if (this.status !== CLEANUP_SUGGESTION_STATUS.pending) throw new CleanupNotPendingError();
        this.status = CLEANUP_SUGGESTION_STATUS.dismissed;
        this.resolvedAt = now;
    }
}
