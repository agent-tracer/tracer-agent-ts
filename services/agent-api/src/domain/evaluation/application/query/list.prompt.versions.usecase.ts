import { Inject, Injectable } from "@nestjs/common";
import { PROMPT_REPOSITORY, type PromptRepositoryPort } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";
@Injectable()
export class ListPromptVersionsUseCase {
    constructor(@Inject(PROMPT_REPOSITORY) private readonly repository: PromptRepositoryPort) {}
    execute(userId: string, definitionId: string) { return this.repository.listPromptVersions(userId, definitionId); }
}
