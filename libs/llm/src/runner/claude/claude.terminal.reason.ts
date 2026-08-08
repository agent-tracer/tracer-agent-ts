import { PROVIDER_ERROR_SUBTYPE } from "~llm/model/agent.error.js";

/** SDK가 실행을 끝낸 까닭 가운데 공급자 사정만 이 실행기의 어휘로 옮기며 나머지는 서브타입 판정에 맡긴다. */
const BY_TERMINAL_REASON: Readonly<Record<string, string>> = {
    // 호출을 막은 한도와 급속 충전 차단기는 모두 잠시 뒤 다시 부르면 풀린다.
    blocking_limit: PROVIDER_ERROR_SUBTYPE.rateLimit,
    rapid_refill_breaker: PROVIDER_ERROR_SUBTYPE.rateLimit,
    // 입력이 창을 넘긴 것은 같은 봉투로 다시 불러도 같은 자리에서 막힌다.
    prompt_too_long: PROVIDER_ERROR_SUBTYPE.requestTooLarge,
};

/** 공급자 사정으로 끝난 실행이면 그 사유를 내고 아니면 null 을 내어 서브타입 판정을 그대로 둔다. */
export function providerSubtypeFromTerminalReason(reason: string | undefined): string | null {
    if (reason === undefined) return null;
    return BY_TERMINAL_REASON[reason] ?? null;
}
