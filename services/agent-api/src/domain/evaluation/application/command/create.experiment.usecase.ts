import { Inject, Injectable } from "@nestjs/common";
import type { Experiment, ExperimentVariant, PromptBackend } from "~agent-api/domain/evaluation/model/experiment.model.js";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";
import {
    EXPERIMENT_CLOCK,
    EXPERIMENT_ID_GENERATOR,
    type ExperimentClockPort,
    type ExperimentIdGeneratorPort,
} from "~agent-api/domain/evaluation/port/experiment.support.port.js";

export interface CreateExperimentInput {
    readonly userId: string;
    readonly datasetId: string;
    readonly datasetRevision: number;
    readonly evaluatorSetVersion: string;
    readonly maxBudgetUsd: number;
    readonly repetitions: number;
    readonly variants: readonly {
        readonly name: string; readonly baseline: boolean; readonly backend: PromptBackend;
        readonly agentName: string; readonly promptVersionId?: string; readonly toolContractVersion: string;
        readonly limits?: Readonly<Record<string, unknown>>;
        readonly fragmentSelections?: Readonly<Record<string, string>>;
    }[];
}

@Injectable()
export class CreateExperimentUseCase {
    constructor(
        @Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort,
        @Inject(EXPERIMENT_ID_GENERATOR) private readonly ids: ExperimentIdGeneratorPort,
        @Inject(EXPERIMENT_CLOCK) private readonly clock: ExperimentClockPort,
    ) {}

    async execute(input: CreateExperimentInput): Promise<{ experiment: Experiment; variants: readonly ExperimentVariant[] }> {
        if (!Number.isFinite(input.maxBudgetUsd) || input.maxBudgetUsd <= 0 || input.repetitions < 1) {
            throw new Error("Experiment budget and repetitions are invalid");
        }
        if (input.variants.length < 2 || input.variants.filter((row) => row.baseline).length !== 1
            || new Set(input.variants.map((row) => row.name)).size !== input.variants.length) {
            throw new Error("Experiment requires distinct variants and exactly one baseline");
        }
        if (!await this.repository.referencesExist(
            input.userId, input.datasetId, input.datasetRevision, input.evaluatorSetVersion,
        )) throw new Error("Experiment references are invalid");
        const experiment: Experiment = {
            id: this.ids.next("experiment"), userId: input.userId, datasetId: input.datasetId,
            datasetRevision: input.datasetRevision, evaluatorSetVersion: input.evaluatorSetVersion,
            maxBudgetUsd: input.maxBudgetUsd, repetitions: input.repetitions, status: "draft",
            createdAt: this.clock.now(), completedAt: null,
        };
        const variants = input.variants.map((row): ExperimentVariant => ({
            ...row, id: this.ids.next("variant"), experimentId: experiment.id,
            promptVersionId: row.promptVersionId ?? null, limits: row.limits ?? {},
            fragmentSelections: row.fragmentSelections ?? {},
        }));
        await this.repository.saveExperiment(experiment, variants);
        return { experiment, variants };
    }
}
