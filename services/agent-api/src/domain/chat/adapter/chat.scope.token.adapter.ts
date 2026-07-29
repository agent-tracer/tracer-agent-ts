import { Injectable } from "@nestjs/common";
import { featureLimits } from "@tracer-agent/llm";
import { issueExecutionScopeToken } from "@tracer-agent/platform";
import { CHAT_FEATURE } from "~agent-api/domain/chat/model/chat.const.js";
import type { ChatScopeGrant, ChatScopeTokenPort } from "~agent-api/domain/chat/port/chat.scope.token.port.js";

// 시도의 마감보다 조금 더 살아야 마감 직전의 도구 호출이 자격을 잃지 않는다.
const TTL_MARGIN_MS = 60_000;

/** 실행 시도의 마감을 넘겨 살아남지 않는 범위 자격을 서명으로만 발급한다. */
@Injectable()
export class ChatScopeTokenAdapter implements ChatScopeTokenPort {
    issue(grant: ChatScopeGrant, now: Date): string | null {
        return issueExecutionScopeToken({
            userId: grant.userId,
            executionId: grant.executionId,
            ttlMs: featureLimits(CHAT_FEATURE).deadlineMs + TTL_MARGIN_MS,
            now,
        });
    }
}
