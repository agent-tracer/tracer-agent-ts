import type { PromptFragmentManifestEntry, ResolvedPromptFragment } from "@tracer-agent/llm";

export interface ChatPromptFragmentRegistryPort {
    /** 파일 조각을 등록 창구에 올리고 이 프로파일이 이번 실행에 쓸 판을 받는다. */
    registerAndResolve(
        profile: string,
        manifest: readonly PromptFragmentManifestEntry[],
    ): Promise<readonly ResolvedPromptFragment[]>;
}
