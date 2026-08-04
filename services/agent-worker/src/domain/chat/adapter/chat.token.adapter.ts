import { createHash, randomBytes } from "node:crypto";
import { issueExecutionScopeToken } from "@tracer-agent/platform";
import { CHAT_SPEC } from "~agent-worker/domain/chat/model/chat.spec.js";
import type {
    ChatDraftGrant,
    ChatDraftTokenPort,
    ChatScopeGrant,
    ChatScopeTokenPort,
} from "~agent-worker/domain/chat/port/chat.token.port.js";

const TOKEN_BYTES = 32;

// 시도의 마감보다 조금 더 살아야 마감 직전의 도구 호출이 자격을 잃지 않는다.
const TTL_MARGIN_MS = 60_000;

/** draft 자격을 난수로 발급하고 저장에는 되돌릴 수 없는 지문만 남긴다. */
export class ChatDraftTokenAdapter implements ChatDraftTokenPort {
    issue(): ChatDraftGrant {
        const token = randomBytes(TOKEN_BYTES).toString("base64url");
        return { token, hash: this.hash(token) };
    }

    hash(token: string): string {
        return createHash("sha256").update(token).digest("hex");
    }
}

/** 실행 시도의 마감과 함께 만료하는 범위 자격을 서명으로만 발급한다. */
export class ChatScopeTokenAdapter implements ChatScopeTokenPort {
    issue(grant: ChatScopeGrant, now: Date): string | null {
        return issueExecutionScopeToken({
            userId: grant.userId,
            executionId: grant.executionId,
            ttlMs: CHAT_SPEC.limits.deadlineMs + TTL_MARGIN_MS,
            now,
        });
    }
}
