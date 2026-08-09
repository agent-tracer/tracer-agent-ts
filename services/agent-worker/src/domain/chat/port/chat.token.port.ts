/** 발급한 자격의 평문과 저장용 지문이며 평문은 실행에만 나가고 저장은 지문만 한다. */
/** 실행 하나가 자기 사용자 범위 안에서만 API를 부르도록 실행 시도에 매이는 자격이다. */
export interface ChatScopeGrant {
    readonly userId: string;
    readonly executionId: string;
}

/** 실행 시도마다 범위 자격을 발급하되 서명 비밀이 없으면 null을 내 자기신고 헤더만 남긴다. */
export interface ChatScopeTokenPort {
    issue(grant: ChatScopeGrant, now: Date): string | null;
}
