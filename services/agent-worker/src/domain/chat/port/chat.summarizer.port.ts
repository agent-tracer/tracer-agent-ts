/** 요약 한 건을 내는 단발 질의 입력이며 도구를 쓰지 않아 대화 턴 입력보다 훨씬 좁다. */
export interface ChatSummarizeRequest {
    readonly systemPrompt: string;
    readonly prompt: string;
    /** 러너가 로컬 자격을 요구할 때 실어 보낼 사용자 키다. */
    readonly apiKey?: string;
}

/** 도구 없는 단발 언어 모델 호출로 대화 압축 요약 텍스트를 내는 포트다. */
export interface ChatSummarizerPort {
    /** 사용자 키 없이는 실행할 수 없는 러너인지이며 부르는 쪽이 키를 찾을지 정한다. */
    requiresLocalApiKey(): boolean;
    summarize(request: ChatSummarizeRequest): Promise<string>;
}
