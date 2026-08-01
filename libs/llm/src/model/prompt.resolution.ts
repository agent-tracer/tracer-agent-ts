/** 실행에 실리는 계약의 판이며 구현체가 지어낸 판 문자열을 담지 않는다. */
export interface ResolvedAgentPrompt {
    readonly promptVersion: string;
    readonly toolContractVersion: string;
}
