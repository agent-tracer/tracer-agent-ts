import { CHAT_PROMPT_FRAGMENT_MANIFEST } from "~agent-worker/domain/chat/model/chat.prompt.fragments.js";
import type { ChatPromptFragmentRegistryPort } from "~agent-worker/domain/chat/port/chat.prompt.fragment.registry.port.js";
import type { ChatPromptFragmentSnapshotPort } from "~agent-worker/domain/chat/port/chat.prompt.fragment.snapshot.port.js";

/** 부팅이 조각을 등록하고 받은 판으로 스냅샷을 세우며, 닿지 못하거나 판이 어긋나면 부팅이 실패한다. */
export async function initializeChatPromptFragments(
    snapshot: ChatPromptFragmentSnapshotPort,
    registry: ChatPromptFragmentRegistryPort,
    profile: string,
): Promise<void> {
    const resolved = await registry.registerAndResolve(profile, CHAT_PROMPT_FRAGMENT_MANIFEST);
    snapshot.initialize(CHAT_PROMPT_FRAGMENT_MANIFEST, resolved);
}
