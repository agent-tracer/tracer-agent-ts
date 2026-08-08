import { ChatMemoryRejectedError } from "./chat.errors.js";
import { memoryRejection } from "./chat.memory.policy.js";

export interface ChatUserMemoryCreateInput {
    readonly id: string;
    readonly userId: string;
    /** 안정된 슬러그이며, 같은 사용자 안에서 재작성 대상을 찾는 키다. */
    readonly key: string;
    readonly content: string;
    readonly now: Date;
}

/** 스레드를 가로질러 한 사용자에 대해 오래 기억하는 사실 한 건이다. */
export class ChatUserMemory {
    id!: string;

    userId!: string;

    key!: string;

    content!: string;

    createdAt!: Date;

    updatedAt!: Date;

    static create(input: ChatUserMemoryCreateInput): ChatUserMemory {
        // 실을 수 없는 내용은 원장에 닿기 전에 막아야 어느 쓰기 경로로 와도 같은 거절을 받는다.
        const rejection = memoryRejection(input.content);
        if (rejection !== null) throw new ChatMemoryRejectedError(rejection);

        const memory = new ChatUserMemory();
        memory.id = input.id;
        memory.userId = input.userId;
        memory.key = input.key;
        memory.content = input.content;
        memory.createdAt = input.now;
        memory.updatedAt = input.now;
        return memory;
    }
}
