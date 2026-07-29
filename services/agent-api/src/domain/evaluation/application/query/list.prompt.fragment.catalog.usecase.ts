import { Inject, Injectable } from "@nestjs/common";
import type { PromptBackend } from "~agent-api/domain/evaluation/model/prompt.model.js";
import { PROMPT_REPOSITORY, type PromptRepositoryPort } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";

@Injectable()
export class ListPromptFragmentCatalogUseCase {
    constructor(@Inject(PROMPT_REPOSITORY) private readonly repository: PromptRepositoryPort) {}
    execute(filter: { agentName?: string | undefined; backend?: PromptBackend | undefined }) { return this.repository.listFragmentCatalog(filter); }
}
