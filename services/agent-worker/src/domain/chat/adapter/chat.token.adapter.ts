import { issueExecutionScopeToken } from "@tracer-agent/platform";
import { CHAT_SPEC } from "~agent-worker/domain/chat/model/chat.spec.js";
import type {
    ChatScopeGrant,
    ChatScopeTokenPort,
} from "~agent-worker/domain/chat/port/chat.token.port.js";


// 시도의 마감보다 조금 더 살아야 마감 직전의 도구 호출이 자격을 잃지 않는다.
const TTL_MARGIN_MS = 60_000;

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
