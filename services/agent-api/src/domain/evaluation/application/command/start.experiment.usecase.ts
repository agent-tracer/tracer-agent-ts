import { Inject, Injectable } from "@nestjs/common";
import { buildExperimentPreview, confirmsPreview, type ExperimentStartConfirmation } from "~agent-api/domain/evaluation/model/experiment.preview.model.js";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";
import { EXPERIMENT_DISPATCHER, type ExperimentDispatcherPort } from "~agent-api/domain/evaluation/port/experiment.support.port.js";

@Injectable()
export class StartExperimentUseCase {
    constructor(
        @Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort,
        @Inject(EXPERIMENT_DISPATCHER) private readonly dispatcher: ExperimentDispatcherPort,
    ) {}
    async execute(userId: string, id: string, confirmation: ExperimentStartConfirmation) {
        const experiment = await this.repository.findExperiment(userId, id);
        if (experiment === null || experiment.status !== "draft") throw new Error("Draft experiment not found");
        const variants = await this.repository.listVariants(userId, id);
        const examples = await this.repository.listExamples(userId, experiment.datasetId, experiment.datasetRevision);
        if (variants.length < 2 || examples.length === 0
            || !confirmsPreview(buildExperimentPreview(experiment, examples, variants), confirmation)) {
            throw new Error("Experiment preview changed");
        }
        const claimed = await this.repository.claimDraft(userId, id);
        if (claimed === null) throw new Error("Experiment was already started");
        try {
            return { experiment: claimed, ...(await this.dispatcher.dispatch({ experimentId: id, userId })) };
        } catch (error) {
            await this.repository.restoreDraft(userId, id);
            throw error;
        }
    }
}
