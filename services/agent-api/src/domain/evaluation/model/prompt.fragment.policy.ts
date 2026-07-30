import { computePromptFragmentHash, extractPromptFragmentPlaceholders } from "@tracer-agent/llm";
import {
    PromptFragmentBinding, PromptFragmentChannelAssignment, PromptFragmentDefinition, PromptFragmentVersion,
    type PromptFragmentManifestBinding, type PromptFragmentManifestEntry, type PromptFragmentSource,
    type ResolvedPromptFragment,
} from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import type { PromptChannel } from "~agent-api/domain/evaluation/model/prompt.model.js";

/** 부팅 등록이 심는 채널이다. */
export const SEEDED_FRAGMENT_CHANNEL: PromptChannel = "production";

/** 배포 프로파일이 해소에 쓰는 채널이며 어느 이름이든 production을 본다. */
export function promptFragmentChannel(_profile: string): PromptChannel {
    return "production";
}

/** 조각 무결성 규칙으로 만든 해시이며 요청이 다른 값을 실었으면 거절한다. */
export function resolveFragmentIntegrityHash(content: string, claimed?: string): string {
    const computed = computePromptFragmentHash(content);
    if (claimed !== undefined && claimed !== computed) throw new Error("Prompt content hash mismatch");
    return computed;
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
        id, templateKey: binding.templateKey, fragmentSlot: binding.fragmentSlot, definitionId,
        codeDefaultVersion: entry.defaultVersion, createdAt: now, updatedAt: now,
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
