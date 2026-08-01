import { Inject, Injectable } from "@nestjs/common";
import { ExperimentNotFoundError, ExperimentPreviewChangedError, ExperimentStartConflictError } from "~agent-api/domain/evaluation/model/evaluation.error.js";
import { buildPendingExecutions, planExecutionCoordinates } from "~agent-api/domain/evaluation/model/experiment.execution.plan.js";
import { buildExperimentPreview, confirmsPreview, type ExperimentStartConfirmation } from "~agent-api/domain/evaluation/model/experiment.preview.model.js";
import { toExperimentView } from "~agent-api/domain/evaluation/model/experiment.view.model.js";
import { EVALUATION_ID_GENERATOR, type EvaluationIdGeneratorPort } from "~agent-api/domain/evaluation/port/id.generator.port.js";
import { EXPERIMENT_REPOSITORY, type ExperimentRepositoryPort } from "~agent-api/domain/evaluation/port/experiment.repository.port.js";
import { EXPERIMENT_DISPATCHER, type ExperimentDispatcherPort } from "~agent-api/domain/evaluation/port/experiment.support.port.js";

@Injectable()
export class StartExperimentUseCase {
    constructor(
        @Inject(EXPERIMENT_REPOSITORY) private readonly repository: ExperimentRepositoryPort,
        @Inject(EXPERIMENT_DISPATCHER) private readonly dispatcher: ExperimentDispatcherPort,
        @Inject(EVALUATION_ID_GENERATOR) private readonly ids: EvaluationIdGeneratorPort,
    ) {}
    async execute(userId: string, id: string, confirmation: ExperimentStartConfirmation) {
        const experiment = await this.repository.findExperiment(userId, id);
        if (experiment === null || experiment.status !== "draft") throw new ExperimentNotFoundError(id);
        const variants = await this.repository.listVariants(userId, id);
        const examples = await this.repository.listExamples(userId, experiment.datasetId, experiment.datasetRevision);
        if (variants.length < 2 || examples.length === 0
            || !confirmsPreview(buildExperimentPreview(experiment, examples, variants), confirmation)) {
            throw new ExperimentPreviewChangedError(id);
        }
        const claimed = await this.repository.claimDraft(userId, id);
        if (claimed === null) throw new ExperimentStartConflictError(id);
        try {
            // 워크플로보다 먼저 자리를 세우지 않으면 lease 가 빈 실험을 본다.
            const coordinates = planExecutionCoordinates(
                variants.map((variant) => variant.id),
                examples.map((example) => example.id),
                claimed.repetitions,
            );
            await this.repository.saveExecutions(buildPendingExecutions(id, coordinates, () => this.ids.next("execution")));
            return { experiment: toExperimentView(claimed), ...(await this.dispatcher.dispatch({ experimentId: id, userId })) };
        } catch (error) {
            await this.repository.restoreDraft(userId, id);
            throw error;
        }
    }
}
