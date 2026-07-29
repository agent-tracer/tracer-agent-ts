export const PROMPT_BACKENDS = ["python", "claude-sdk"] as const;
export type PromptBackend = (typeof PROMPT_BACKENDS)[number];
export const PROMPT_CHANNELS = ["candidate", "staging", "production"] as const;
export type PromptChannel = (typeof PROMPT_CHANNELS)[number];

export class PromptDefinition {
    id!: string;
    userId!: string;
    agentName!: string;
    backend!: PromptBackend;
    language!: string;
    name!: string;
    createdAt!: Date;
}

export class PromptVersion {
    id!: string;
    definitionId!: string;
    semanticVersion!: string;
    content!: string;
    contentHash!: string;
    toolContractVersion!: string;
    outputSchemaVersion!: string;
    contentOrigin!: "file" | "user-authored";
    createdBy!: string;
    createdAt!: Date;
}

export class PromptChannelAssignment {
    id!: string;
    definitionId!: string;
    channel!: PromptChannel;
    versionId!: string;
    updatedAt!: Date;
}

export class PromptPromotion {
    id!: string;
    userId!: string;
    promptVersionId!: string;
    experimentId!: string | null;
    fromChannel!: PromptChannel | null;
    toChannel!: PromptChannel;
    gateResult!: Record<string, unknown>;
    promotedBy!: string;
    promotedAt!: Date;
}

export interface PromptVersionInput {
    readonly semanticVersion: string;
    readonly content: string;
    readonly contentHash?: string | undefined;
    readonly toolContractVersion: string;
    readonly outputSchemaVersion: string;
}
