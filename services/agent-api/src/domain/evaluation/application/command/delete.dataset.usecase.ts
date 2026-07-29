import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EVALUATION_REPOSITORY, type EvaluationRepositoryPort } from "~agent-api/domain/evaluation/port/evaluation.repository.port.js";

@Injectable()
export class DeleteDatasetUseCase {
    constructor(@Inject(EVALUATION_REPOSITORY) private readonly repository: EvaluationRepositoryPort) {}

    async execute(userId: string, id: string): Promise<void> {
        if (await this.repository.findDataset(userId, id) === null) {
            throw new NotFoundException("Dataset not found");
        }
        try {
            await this.repository.deleteDataset(userId, id);
        } catch (error) {
            if (isForeignKeyViolation(error)) {
                throw new BadRequestException("Cannot delete dataset because it is referenced by an experiment");
            }
            throw error;
        }
    }
}

function isForeignKeyViolation(error: unknown): boolean {
    if (errorCode(error) === "23503") return true;
    const nested = typeof error === "object" && error !== null
        ? (error as { readonly driverError?: unknown }).driverError
        : undefined;
    return errorCode(nested) === "23503";
}

function errorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) return undefined;
    const code = (error as { readonly code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
}
