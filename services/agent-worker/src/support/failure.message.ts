// 오케스트레이션 엔진이 활동 오류를 감싸므로 사용자에게 보일 값은 원인 사슬 맨 안쪽에 있다.
export function messageOf(err: unknown): string {
    if (!(err instanceof Error)) return String(err);
    let deepest = err;
    for (let cause = err.cause; cause instanceof Error; cause = cause.cause) {
        deepest = cause;
    }
    return deepest.message.length > 0 ? deepest.message : err.message;
}
