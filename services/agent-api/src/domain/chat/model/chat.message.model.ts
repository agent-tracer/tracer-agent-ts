import { CHAT_MESSAGE_ROLE, type ChatMessageRole } from "~agent-api/domain/chat/model/chat.const.js";

/** 어시스턴트 메시지가 제안하는 도구 호출 한 건이며, args는 모델이 낸 원본 인자다. */
export interface ChatToolCall {
    readonly id: string;
    readonly name: string;
    readonly args: Record<string, unknown>;
}

export interface ChatMessageCreateInput {
    readonly id: string;
    readonly threadId: string;
    readonly role: ChatMessageRole;
    readonly content: string;
    readonly toolCalls?: readonly ChatToolCall[];
    readonly toolCallId?: string;
    readonly now: Date;
}

/** 스레드에 쌓인 대화 한 줄이며 도구 호출과 그 결과도 같은 자리에 실린다. */
export class ChatMessage {
    id!: string;

    threadId!: string;

    role!: ChatMessageRole;

    content!: string;

    /** 어시스턴트가 도구 호출을 제안한 턴에만 값이 있고, 그 외 역할에는 null이다. */
    toolCalls!: readonly ChatToolCall[] | null;

    /** role이 tool일 때 어느 호출의 결과인지를 잇는 식별자이며, 그 외 역할에는 null이다. */
    toolCallId!: string | null;

    createdAt!: Date;

    static create(input: ChatMessageCreateInput): ChatMessage {
        const message = new ChatMessage();
        message.id = input.id;
        message.threadId = input.threadId;
        message.role = input.role;
        message.content = input.content;
        message.toolCalls = input.toolCalls && input.toolCalls.length > 0 ? [...input.toolCalls] : null;
        message.toolCallId = input.toolCallId ?? null;
        message.createdAt = input.now;
        return message;
    }

    isFromTool(): boolean {
        return this.role === CHAT_MESSAGE_ROLE.tool;
    }

    proposesToolCall(): boolean {
        return this.role === CHAT_MESSAGE_ROLE.assistant && (this.toolCalls?.length ?? 0) > 0;
    }
}
