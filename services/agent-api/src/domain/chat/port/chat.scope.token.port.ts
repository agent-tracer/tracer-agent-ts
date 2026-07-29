export const CHAT_SCOPE_TOKEN = Symbol("ChatScopeToken");

/** 실행 하나가 자기 사용자 범위 안에서만 API를 부르도록 실행 시도에 매이는 자격이다. */
export interface ChatScopeGrant {
    readonly userId: string;
    readonly executionId: string;
}

/** 실행 시도마다 범위 자격을 발급하되, 서명 비밀이 없는 환경에서는 null을 내 호출이 자기신고 헤더로만 식별되게 둔다. */
export interface ChatScopeTokenPort {
    issue(grant: ChatScopeGrant, now: Date): string | null;
}
