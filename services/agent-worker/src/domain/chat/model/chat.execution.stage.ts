import type { ChatTurnResult } from "./chat.turn.model.js";

export interface PreparedChatExecution {
    readonly executionId: string;
    readonly threadId: string;
    readonly userId: string;
    /** 이번 턴의 사용자 메시지이며 재생 창을 여기까지로 자른다. */
    readonly userMessageId: string;
    readonly language: string;
    readonly model?: string;
}

export interface GeneratedChatExecution {
    readonly executionId: string;
    /** 궤적을 시도별로 갈라 남기므로 재시도한 실행도 앞 시도의 궤적을 잃지 않는다. */
    readonly attempt: number;
    readonly result: ChatTurnResult;
}
