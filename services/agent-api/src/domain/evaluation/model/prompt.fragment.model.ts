import type { PromptBackend, PromptChannel } from "~agent-api/domain/evaluation/model/prompt.model.js";

export type PromptFragmentOrigin = "code-default" | "database-authored";

/** 받아 쓰는 쪽이 파일 기본값과 그것을 덮은 판을 가르는 값이다. */
export type PromptFragmentSource = "code-default" | "database-override";

export class PromptFragmentDefinition {
    id!: string;
    definitionKey!: string;
    agentName!: string;
    backend!: PromptBackend;
    language!: string;
    fragmentName!: string;
    codeName!: string;
    createdAt!: Date;
}

export class PromptFragmentVersion {
    id!: string;
    definitionId!: string;
    semanticVersion!: string;
    content!: string;
    contentHash!: string;
    placeholders!: readonly string[];
    toolContractVersion!: string;
    outputSchemaVersion!: string;
    origin!: PromptFragmentOrigin;
    previousVersionId!: string | null;
    changeSummary!: string | null;
    createdBy!: string;
    createdAt!: Date;
}

export class PromptFragmentBinding {
    id!: string;
    templateKey!: string;
    fragmentSlot!: string;
    definitionId!: string;
    codeDefaultVersion!: string;
    createdAt!: Date;
    updatedAt!: Date;
}

export class PromptFragmentChannelAssignment {
    id!: string;
    definitionId!: string;
    channel!: PromptChannel;
    versionId!: string;
    updatedAt!: Date;
}

/** 조각 하나가 채우는 템플릿의 자리다. */
export interface PromptFragmentManifestBinding {
    readonly templateKey: string;
    readonly fragmentSlot: string;
}

/** 배포 단위가 부팅에 싣는 자기 파일 조각 하나이며 definitionKey가 배포를 건너 같은 값이다. */
export interface PromptFragmentManifestEntry {
    readonly backend: PromptBackend;
    readonly agentName: string;
    readonly language: string;
    readonly codeName: string;
    readonly definitionKey: string;
    readonly fragmentName: string;
    readonly defaultVersion: string;
    readonly defaultContent: string;
    readonly toolContractVersion: string;
    readonly outputSchemaVersion: string;
    readonly bindings: readonly PromptFragmentManifestBinding[];
}

/** 이번 실행이 한 자리에 쓸 조각이며 받는 쪽이 해시와 placeholder를 다시 검사한다. */
export interface ResolvedPromptFragment {
    readonly templateKey: string;
    readonly fragmentSlot: string;
    readonly definitionId: string;
    readonly definitionKey: string;
    readonly codeName: string;
    readonly backend: PromptBackend;
    readonly language: string;
    readonly versionId: string;
    readonly semanticVersion: string;
    readonly content: string;
    readonly contentHash: string;
    readonly placeholders: readonly string[];
    readonly toolContractVersion: string;
    readonly outputSchemaVersion: string;
    readonly source: PromptFragmentSource;
}
