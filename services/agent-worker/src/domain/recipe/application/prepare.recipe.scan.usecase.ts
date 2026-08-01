import type { ResolvedAgentPrompt } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import { normalizeOutputLanguage, type OutputLanguage } from "~agent-worker/support/output.language.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { JOB_KIND, JOB_STATUS } from "~agent-worker/support/job.const.js";
import { RECIPE_SCAN_TRIGGER, RECIPE_SETTING_KEY, type RecipeScanTrigger } from "../model/recipe.const.js";
import {
    JobAlreadySettledError,
    JobNotFoundError,
    MissingApiKeyError,
    TaskNotFoundError,
    TaskNotScannableError,
} from "../model/recipe.error.js";
import { resolveRecipePromptPin } from "../model/recipe.prompt.js";
import type { PromptSourcePort } from "~agent-worker/domain/recipe/port/prompt.source.port.js";
import type { RecipeAgentPort } from "../port/recipe.agent.port.js";
import type { RecipeNotificationPort } from "../port/recipe.notification.port.js";
import type { RecipeRepositoryPort } from "../port/recipe.repository.port.js";

export interface RecipeScanInput {
    readonly jobId: string;
    readonly taskId: string;
    readonly language?: string;
    readonly trigger?: RecipeScanTrigger;
    readonly userPrompt?: string;
}

export interface RecipeScanPrep {
    readonly jobId: string;
    readonly userId: string;
    readonly taskId: string;
    readonly language: OutputLanguage;
    readonly prompt: ResolvedAgentPrompt;
    readonly model?: string;
    readonly userPrompt?: string;
}

/** 앵커 자격을 확인하고 잡을 실행 상태로 올린 뒤 실행 인자를 확정한다. */
export class PrepareRecipeScanUsecase {
    constructor(
        private readonly repository: RecipeRepositoryPort,
        private readonly agent: RecipeAgentPort,
        private readonly notification: RecipeNotificationPort,
        private readonly clock: IClock,
        private readonly prompts: PromptSourcePort,
    ) {}

    async execute(input: RecipeScanInput): Promise<RecipeScanPrep> {
        const job = await this.repository.findJob(input.jobId);
        if (job === null) throw new JobNotFoundError(input.jobId);

        const anchor = await this.repository.findAnchor(job.userId, input.taskId);
        if (anchor === null || !anchor.ownedByUser) throw new TaskNotFoundError(input.taskId);
        const eligible = input.trigger === RECIPE_SCAN_TRIGGER.session
            ? anchor.sessionScanEligible
            : anchor.scanEligible;
        if (!eligible) throw new TaskNotScannableError(input.taskId);

        const language = normalizeOutputLanguage(input.language);
        const prompt = resolveRecipePromptPin(await this.prompts.resolve(AGENT.recipeScan.id));
        if (!(await this.repository.startJob(job.id, this.clock.now()))) {
            throw new JobAlreadySettledError(job.id);
        }
        await this.notification.jobUpdated(job.userId, {
            jobId: job.id,
            kind: JOB_KIND.recipeScan,
            status: JOB_STATUS.running,
            taskId: input.taskId,
        });

        if (this.agent.requiresLocalApiKey()) {
            const apiKey = await this.repository.readSetting(
                job.userId,
                RECIPE_SETTING_KEY.anthropicApiKey,
            );
            if (apiKey === null) throw new MissingApiKeyError(RECIPE_SETTING_KEY.anthropicApiKey);
        }

        return {
            jobId: job.id,
            userId: job.userId,
            taskId: input.taskId,
            language,
            prompt,
            ...(input.userPrompt !== undefined ? { userPrompt: input.userPrompt } : {}),
        };
    }
}
