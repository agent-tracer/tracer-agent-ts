/** 저장 행과 궤적 한 줄에 붙일 식별자를 낸다. */
export interface IdGeneratorPort {
    next(): string;
}
