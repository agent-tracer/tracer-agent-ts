import { errorMessage, logWarn } from "@tracer-agent/platform";
import { CHAT_PROMPT_FRAGMENT_MANIFEST } from "~agent-worker/domain/chat/model/chat.prompt.fragments.js";
import type { ChatPromptFragmentRegistryPort } from "~agent-worker/domain/chat/port/chat.prompt.fragment.registry.port.js";
import type { ChatPromptFragmentSnapshotPort } from "~agent-worker/domain/chat/port/chat.prompt.fragment.snapshot.port.js";

/** 부팅이 조각을 등록하고 받은 판으로 스냅샷을 세우며, 닿지 못하면 파일 기본값으로 돌고 부팅은 이어진다. */
export async function initializeChatPromptFragments(
    snapshot: ChatPromptFragmentSnapshotPort,
    registry: ChatPromptFragmentRegistryPort,
    profile: string,
): Promise<void> {
    try {
        const resolved = await registry.registerAndResolve(profile, CHAT_PROMPT_FRAGMENT_MANIFEST);
        snapshot.initialize(CHAT_PROMPT_FRAGMENT_MANIFEST, resolved);
    } catch (error) {
        logWarn({ msg: "agent.prompt.fallback", agentName: "chat", profile, reason: errorMessage(error) });
    }
}
