import { Inject, Injectable } from "@nestjs/common";
import type { PromptFragmentManifestEntry } from "~agent-api/domain/evaluation/model/prompt.fragment.model.js";
import { PROMPT_REPOSITORY, type PromptRepositoryPort } from "~agent-api/domain/evaluation/port/prompt.repository.port.js";

@Injectable()
export class RegisterAndResolvePromptFragmentsUseCase {
    constructor(@Inject(PROMPT_REPOSITORY) private readonly repository: PromptRepositoryPort) {}
    execute(input: { profile: string; manifest: readonly PromptFragmentManifestEntry[] }) {
        return this.repository.registerAndResolveFragments(input.profile, input.manifest);
    }
}
