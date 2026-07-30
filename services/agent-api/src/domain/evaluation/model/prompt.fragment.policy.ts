import { computePromptFragmentHash, extractPromptFragmentPlaceholders } from "@tracer-agent/llm";
import {
    PromptFragmentBinding, PromptFragmentChannelAssignment, PromptFragmentDefinition, PromptFragmentVersion,
    type PromptFragmentManifestBinding, type PromptFragmentManifestEntry, type PromptFragmentSource,
    type ResolvedPromptFragment,
} from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import type { PromptChannel } from "~agent-api/domain/evaluation/model/prompt.model.js";

/** 배포 프로파일마다 실행에 쓰는 조각 채널이며 값은 계약의 조각 레지스트리 선언이 소유한다. */
export const PROFILE_FRAGMENT_CHANNELS: Readonly<Record<string, PromptChannel>> = {
    local: "staging",
    prd: "production",
};

/** 이 배포가 실행에 쓸 조각 채널이며 선언되지 않은 프로파일은 거절한다. */
export function promptFragmentChannel(profile: string): PromptChannel {
    const channel = PROFILE_FRAGMENT_CHANNELS[profile];
    if (channel === undefined) throw new Error(`prompt-fragment.unknown-profile:${profile}`);
    return channel;
}

const CANDIDATE_VERSION = /^candidate-(\d+)$/u;

/** candidate 채널에 쌓인 판 다음의 이름과 그 앞 판이며 한 정의 안에서 판 이름이 겹치지 않게 한다. */
export function nextCandidateFragmentVersion(versions: readonly PromptFragmentVersion[]): {
    readonly semanticVersion: string;
    readonly previousVersionId: string | null;
} {
    const authored = versions
        .flatMap((item) => {
            const match = CANDIDATE_VERSION.exec(item.semanticVersion);
            return match ? [{ ordinal: Number(match[1]), id: item.id }] : [];
        })
        .sort((left, right) => right.ordinal - left.ordinal);
    const latest = authored[0];
    return {
        semanticVersion: `candidate-${(latest?.ordinal ?? 0) + 1}`,
        previousVersionId: latest?.id ?? null,
    };
}

/** 저작한 조각 판이며 계약 판은 코드가 선언한 정의의 것을 그대로 따른다. */
export function authoredFragmentVersion(input: {
    id: string; definitionId: string; semanticVersion: string; content: string; changeSummary: string | null;
    createdBy: string; previousVersionId: string | null; toolContractVersion: string; outputSchemaVersion: string;
    now: Date;
}): PromptFragmentVersion {
    return Object.assign(new PromptFragmentVersion(), {
        id: input.id, definitionId: input.definitionId, semanticVersion: input.semanticVersion,
        content: input.content, contentHash: computePromptFragmentHash(input.content),
        placeholders: extractPromptFragmentPlaceholders(input.content),
        toolContractVersion: input.toolContractVersion, outputSchemaVersion: input.outputSchemaVersion,
        origin: "database-authored", previousVersionId: input.previousVersionId,
        changeSummary: input.changeSummary, createdBy: input.createdBy, createdAt: input.now,
    });
}

export function newFragmentDefinition(entry: PromptFragmentManifestEntry, id: string, now: Date): PromptFragmentDefinition {
    return Object.assign(new PromptFragmentDefinition(), {
        id, definitionKey: entry.definitionKey, agentName: entry.agentName, backend: entry.backend,
        language: entry.language, fragmentName: entry.fragmentName, codeName: entry.codeName, createdAt: now,
    });
}

export function newFragmentVersion(entry: PromptFragmentManifestEntry, id: string, definitionId: string, now: Date): PromptFragmentVersion {
    return Object.assign(new PromptFragmentVersion(), {
        id, definitionId, semanticVersion: entry.defaultVersion, content: entry.defaultContent,
        contentHash: computePromptFragmentHash(entry.defaultContent),
        placeholders: extractPromptFragmentPlaceholders(entry.defaultContent),
        toolContractVersion: entry.toolContractVersion, outputSchemaVersion: entry.outputSchemaVersion,
        origin: "code-default", previousVersionId: null, changeSummary: null, createdBy: "system", createdAt: now,
    });
}

export function newFragmentBinding(entry: PromptFragmentManifestEntry, binding: PromptFragmentManifestBinding,
    id: string, definitionId: string, now: Date): PromptFragmentBinding {
    return Object.assign(new PromptFragmentBinding(), {
        id, backend: entry.backend, templateKey: binding.templateKey, fragmentSlot: binding.fragmentSlot,
        definitionId, codeDefaultVersion: entry.defaultVersion, createdAt: now, updatedAt: now,
    });
}

export function newFragmentChannel(id: string, definitionId: string, channel: PromptChannel,
    versionId: string, now: Date): PromptFragmentChannelAssignment {
    return Object.assign(new PromptFragmentChannelAssignment(), { id, definitionId, channel, versionId, updatedAt: now });
}

export function resolveFragment(binding: PromptFragmentManifestBinding, definition: PromptFragmentDefinition,
    version: PromptFragmentVersion): ResolvedPromptFragment {
    const source: PromptFragmentSource = version.origin === "code-default" ? "code-default" : "database-override";
    return {
        templateKey: binding.templateKey, fragmentSlot: binding.fragmentSlot, definitionId: definition.id,
        definitionKey: definition.definitionKey, codeName: definition.codeName, backend: definition.backend,
        language: definition.language, versionId: version.id, semanticVersion: version.semanticVersion,
        content: version.content, contentHash: version.contentHash, placeholders: version.placeholders,
        toolContractVersion: version.toolContractVersion, outputSchemaVersion: version.outputSchemaVersion, source,
    };
}
