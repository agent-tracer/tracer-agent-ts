import type { ChatScopeGrant, ChatScopeTokenPort } from "~agent-api/domain/chat/port/chat.scope.token.port.js";

/** 범위 자격 포트의 대역이며 생성자로 넘긴 값을 그대로 낸다. */
export class FixedChatScopeToken implements ChatScopeTokenPort {
    constructor(private readonly token: string | null = "scope-token") {}

    issue(_grant: ChatScopeGrant, _now: Date): string | null {
        return this.token;
    }
}
