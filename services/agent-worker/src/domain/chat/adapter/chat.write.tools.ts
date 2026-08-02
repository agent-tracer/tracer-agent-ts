import type { ToolHandlers } from "@tracer-agent/llm";
import { parseChatToolArgs } from "~agent-worker/domain/chat/model/chat.tool.schema.js";
import type { ChatTurnToolCall } from "~agent-worker/domain/chat/model/chat.turn.model.js";
import { chatWriteToolNames } from "./chat.tool.surface.js";
import { chatApiHeaders, telemetered, unwrapChatApiEnvelope } from "./chat.tool.support.js";

const CHAT_THREADS_PATH = "/api/agent/chat/threads";

/** 확인 창구 한 번의 결과이며 성공이면 봉투를 벗긴 본문이 text에 담긴다. */
export interface ChatProposalResult {
    readonly ok: boolean;
    readonly statusCode: number;
    readonly text: string;
}

/** 한 사용자의 한 스레드에만 대기 행을 세우도록 생성 시점에 범위가 묶인 확인 창구다. */
export class ChatWriteClient {
    private readonly baseUrl: string;

    constructor(
        baseUrl: string,
        private readonly threadId: string,
        private readonly userId: string,
        private readonly scopeToken: string | undefined,
    ) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
    }

    /** 쓰기 도구 호출 하나를 실행하지 않고 확인 대기 행으로 세운다. */
    async propose(
        toolName: string,
        args: Readonly<Record<string, unknown>>,
    ): Promise<ChatProposalResult> {
        const url = `${this.baseUrl}${CHAT_THREADS_PATH}/${encodeURIComponent(this.threadId)}/confirmations`;
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                ...chatApiHeaders(this.userId, this.scopeToken),
            },
            body: JSON.stringify({ toolName, args }),
        });
        const text = await response.text();
        if (response.status >= 400) return { ok: false, statusCode: response.status, text };
        return { ok: true, statusCode: response.status, text: unwrapChatApiEnvelope(text) };
    }
}

/** 세운 확인 대기 행이며 id가 곧 승인 결과 메시지가 인용할 도구 호출 식별자다. */
export interface ChatWriteTools {
    readonly handlers: ToolHandlers;
    readonly proposals: readonly ChatTurnToolCall[];
}

/** 사용자와 스레드가 이미 묶인 확인 창구 위에 쓰기 도구를 세운다. */
export function buildChatWriteToolHandlers(client: ChatWriteClient): ChatWriteTools {
    const proposals: ChatTurnToolCall[] = [];
    const handlers: Record<string, (raw: Record<string, unknown>) => Promise<string>> = {};
    for (const name of chatWriteToolNames()) {
        handlers[name] = async (raw) => {
            const args = parseChatToolArgs(name, raw);
            return telemetered(name, args, async () => {
                const result = await client.propose(name, args);
                // 계약 문장으로 옮기는 일은 도구 경계가 하므로 여기서는 사유만 던진다.
                if (!result.ok) throw new Error(`the confirmation API answered ${result.statusCode}`);
                proposals.push({ id: confirmationIdOf(result.text), name, args });
                return result.text;
            });
        };
    }
    return { handlers, proposals };
}

/** 승인 결과 메시지가 이 id를 인용하므로 창구가 id를 내지 않으면 짝 없는 도구 호출이 된다. */
function confirmationIdOf(text: string): string {
    const payload: unknown = JSON.parse(text);
    const id = (payload as { confirmationId?: unknown }).confirmationId;
    if (typeof id !== "string" || id.length === 0) {
        throw new Error("the confirmation API answered without an id");
    }
    return id;
}
