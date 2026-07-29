import type { ChatDraftGrant, ChatDraftTokenPort } from "~agent-api/domain/chat/port/chat.draft.token.port.js";

/** draft 자격 포트의 대역이며 평문 앞에 접두사를 붙인 값을 지문으로 삼는다. */
export class FixedChatDraftToken implements ChatDraftTokenPort {
    constructor(private readonly token = "draft-token") {}

    issue(): ChatDraftGrant {
        return { token: this.token, hash: this.hash(this.token) };
    }

    hash(token: string): string {
        return `hash:${token}`;
    }
}
