import { InvariantViolationError } from "@tracer-agent/platform";
import {
    CHAT_PENDING_TOOL_STATUS,
    type ChatPendingToolStatus,
} from "~agent-api/domain/chat/model/chat.const.js";

export interface ChatPendingToolCreateInput {
    readonly id: string;
    readonly threadId: string;
    /** 이 도구를 제안한 어시스턴트 메시지이며, 없으면 null이다. */
    readonly messageId: string | null;
    readonly toolName: string;
    readonly args: Record<string, unknown>;
    readonly now: Date;
}

/** 사용자의 승인을 기다리는 쓰기 도구 호출 한 건이다. */
export class ChatPendingTool {
    id!: string;

    threadId!: string;

    messageId!: string | null;

    toolName!: string;

    args!: Record<string, unknown>;

    status!: ChatPendingToolStatus;

    createdAt!: Date;

    resolvedAt!: Date | null;

    static create(input: ChatPendingToolCreateInput): ChatPendingTool {
        const pending = new ChatPendingTool();
        pending.id = input.id;
        pending.threadId = input.threadId;
        pending.messageId = input.messageId;
        pending.toolName = input.toolName;
        pending.args = input.args;
        pending.status = CHAT_PENDING_TOOL_STATUS.pending;
        pending.createdAt = input.now;
        pending.resolvedAt = null;
        return pending;
    }

    approve(now: Date): void {
        this.resolve(CHAT_PENDING_TOOL_STATUS.approved, now);
    }

    reject(now: Date): void {
        this.resolve(CHAT_PENDING_TOOL_STATUS.rejected, now);
    }

    isPending(): boolean {
        return this.status === CHAT_PENDING_TOOL_STATUS.pending;
    }

    private resolve(status: ChatPendingToolStatus, now: Date): void {
        if (!this.isPending()) throw new InvariantViolationError("chat-pending-tool.already-resolved");
        this.status = status;
        this.resolvedAt = now;
    }
}
