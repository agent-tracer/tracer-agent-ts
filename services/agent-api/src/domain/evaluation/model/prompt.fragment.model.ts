import type { PromptBackend, PromptChannel } from "~agent-api/domain/evaluation/model/prompt.model.js";

export type PromptFragmentOrigin = "code-default" | "database-authored";

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

export interface PromptFragmentManifestEntry {
    readonly templateKey: string;
    readonly fragmentSlot: string;
    readonly agentName: string;
    readonly backend: PromptBackend;
    readonly language: string;
    readonly fragmentName: string;
    readonly codeName: string;
    readonly semanticVersion: string;
    readonly content: string;
    readonly toolContractVersion: string;
    readonly outputSchemaVersion: string;
}

export interface ResolvedPromptFragment {
    readonly templateKey: string;
    readonly fragmentSlot: string;
    readonly definitionId: string;
    readonly versionId: string;
    readonly content: string;
    readonly contentHash: string;
}

export function extractFragmentPlaceholders(content: string): readonly string[] {
    return [...content.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((match) => match[1]!).filter(
        (value, index, values) => values.indexOf(value) === index,
    );
}
