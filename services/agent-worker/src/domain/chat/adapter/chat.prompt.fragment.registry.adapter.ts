import type { PromptFragmentManifestEntry, ResolvedPromptFragment } from "@tracer-agent/llm";
import type { ChatPromptFragmentRegistryPort } from "~agent-worker/domain/chat/port/chat.prompt.fragment.registry.port.js";
import { unwrapChatApiEnvelope } from "./chat.tool.support.js";

const REGISTER_AND_RESOLVE_PATH = "/internal/prompts/fragments/register-and-resolve";

export class ChatPromptFragmentRegistryAdapter implements ChatPromptFragmentRegistryPort {
    private readonly baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
    }

    async registerAndResolve(
        profile: string,
        manifest: readonly PromptFragmentManifestEntry[],
    ): Promise<readonly ResolvedPromptFragment[]> {
        const response = await fetch(`${this.baseUrl}${REGISTER_AND_RESOLVE_PATH}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ profile, manifest }),
        });
        const text = await response.text();
        if (response.status >= 400) throw new Error(`the prompt fragment registry answered ${response.status}`);
        const data: unknown = JSON.parse(unwrapChatApiEnvelope(text));
        if (!Array.isArray(data)) throw new Error("the prompt fragment registry answered a body that is not a list");
        return data.map(toResolvedFragment);
    }
}

/** 창구가 싣는 원장 식별자를 떼고 실행이 쓰는 값만 남긴다. */
function toResolvedFragment(item: ResolvedPromptFragment): ResolvedPromptFragment {
    return {
        templateKey: item.templateKey,
        fragmentSlot: item.fragmentSlot,
        definitionKey: item.definitionKey,
        codeName: item.codeName,
        backend: item.backend,
        language: item.language,
        versionId: item.versionId,
        semanticVersion: item.semanticVersion,
        content: item.content,
        contentHash: item.contentHash,
        placeholders: item.placeholders,
        toolContractVersion: item.toolContractVersion,
        outputSchemaVersion: item.outputSchemaVersion,
        source: item.source,
    };
}
