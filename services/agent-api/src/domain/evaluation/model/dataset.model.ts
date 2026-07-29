import {
    DISCLOSURE_CLASSES,
    requireInteger,
    requireMember,
    requireNonEmpty,
    type DisclosureClass,
} from "./evaluation.types.js";

/** 평가 입력 묶음의 소유권과 현재 개정을 나타낸다. */
export class EvaluationDataset {
    id!: string;
    userId!: string;
    name!: string;
    description!: string;
    currentRevision!: number;
    createdAt!: Date;

    static create(id: string, userId: string, name: string, description: string, now: Date): EvaluationDataset {
        for (const value of [id, userId, name]) requireNonEmpty(value, "dataset.invalid");
        return Object.assign(new EvaluationDataset(), {
            id,
            userId,
            name,
            description,
            currentRevision: 1,
            createdAt: now,
        });
    }

    nextRevision(): number {
        this.currentRevision += 1;
        return this.currentRevision;
    }

    isOwnedBy(userId: string): boolean {
        return this.userId === userId;
    }
}

export interface EvaluationExampleInput {
    readonly input: Record<string, unknown>;
    readonly referenceOutput?: Record<string, unknown> | null | undefined;
    readonly metadata?: Record<string, unknown> | undefined;
    readonly disclosureClass: DisclosureClass;
    readonly sourceExecutionId?: string | null | undefined;
    readonly evidence?: Record<string, unknown> | undefined;
}

export interface EvaluationExampleCreateInput extends EvaluationExampleInput {
    readonly id: string;
    readonly datasetId: string;
    readonly revision: number;
    readonly contentHash: string;
}

/** 평가 한 건의 고정 입력과 근거를 나타낸다. */
export class EvaluationExample {
    id!: string;
    datasetId!: string;
    revision!: number;
    input!: Record<string, unknown>;
    referenceOutput!: Record<string, unknown> | null;
    metadata!: Record<string, unknown>;
    disclosureClass!: DisclosureClass;
    sourceExecutionId!: string | null;
    contentHash!: string;
    evidence!: Record<string, unknown>;
    enabled!: boolean;

    static create(input: EvaluationExampleCreateInput): EvaluationExample {
        for (const value of [input.id, input.datasetId, input.contentHash]) {
            requireNonEmpty(value, "dataset.invalid-example");
        }
        requireInteger(input.revision, 1, "dataset.invalid-revision");
        requireMember(input.disclosureClass, DISCLOSURE_CLASSES, "dataset.invalid-disclosure-class");
        return Object.assign(new EvaluationExample(), input, {
            referenceOutput: input.referenceOutput ?? null,
            metadata: input.metadata ?? {},
            sourceExecutionId: input.sourceExecutionId ?? null,
            evidence: input.evidence ?? {},
            enabled: true,
        });
    }
}
