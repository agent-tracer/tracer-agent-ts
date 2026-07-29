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
