export const CHAT_ID_GENERATOR = Symbol("ChatIdGenerator");

export interface ChatIdGeneratorPort {
    next(): string;
}
