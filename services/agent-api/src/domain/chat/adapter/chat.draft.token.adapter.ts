import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { ChatDraftGrant, ChatDraftTokenPort } from "~agent-api/domain/chat/port/chat.draft.token.port.js";

const TOKEN_BYTES = 32;

/** draft 자격을 난수로 발급하고 저장에는 되돌릴 수 없는 지문만 남긴다. */
@Injectable()
export class ChatDraftTokenAdapter implements ChatDraftTokenPort {
    issue(): ChatDraftGrant {
        const token = randomBytes(TOKEN_BYTES).toString("base64url");
        return { token, hash: this.hash(token) };
    }

    hash(token: string): string {
        return createHash("sha256").update(token).digest("hex");
    }
}
