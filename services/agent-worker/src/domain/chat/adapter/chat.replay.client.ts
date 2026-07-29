import type {
    ChatReplayPort,
    ChatReplayResponse,
} from "~agent-worker/domain/chat/port/chat.replay.port.js";
import { chatApiHeaders, unwrapChatApiEnvelope } from "./chat.tool.support.js";

const CHAT_THREADS_PATH = "/api/v1/chat/threads";

/** 실행이 무엇이든 같은 재생 계산을 받도록 자기 원장으로 다시 구하지 않고 접수를 되읽는다. */
export class ChatReplayClient implements ChatReplayPort {
    private readonly baseUrl: string;

    constructor(
        baseUrl: string,
        private readonly userId: string,
        private readonly scopeToken: string | undefined,
    ) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
    }

    async fetchReplay(threadId: string, executionId: string): Promise<ChatReplayResponse> {
        const url = `${this.baseUrl}${CHAT_THREADS_PATH}/${encodeURIComponent(threadId)}`
            + `/executions/${encodeURIComponent(executionId)}/replay`;
        const response = await fetch(url, { headers: chatApiHeaders(this.userId, this.scopeToken) });
        const text = await response.text();
        if (response.status >= 400) throw new Error(`the replay API answered ${response.status}`);
        return JSON.parse(unwrapChatApiEnvelope(text)) as ChatReplayResponse;
    }
}
