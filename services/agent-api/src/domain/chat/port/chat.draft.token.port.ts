export const CHAT_DRAFT_TOKEN = Symbol("ChatDraftToken");

/** 발급한 자격의 평문과 저장용 지문이며, 평문은 실행기에만 나가고 저장은 지문만 한다. */
export interface ChatDraftGrant {
    readonly token: string;
    readonly hash: string;
}

/** 실행 시도 하나에 묶이는 draft 통지 자격을 발급하고 되받은 자격을 지문으로 옮긴다. */
export interface ChatDraftTokenPort {
    issue(): ChatDraftGrant;
    hash(token: string): string;
}
