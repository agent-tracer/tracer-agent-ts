import type { ResolvedAgentPrompt } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import { chosenJobModel, normalizeOutputLanguage, type OutputLanguage } from "~agent-worker/support/output.language.js";
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
import type { PromptSourcePort } from "~agent-worker/support/prompt.source.port.js";
import type { RecipeAgentPort } from "../port/recipe.agent.port.js";
import type { JobNotificationPort } from "~agent-worker/support/job.notification.port.js";
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
        private readonly notification: JobNotificationPort,
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

        // 요청이 언어를 실었으면 그 값이 우선하고, 비었으면 설정을 읽는다.
        const language = normalizeOutputLanguage(
            input.language
                ?? await this.repository.readSetting(job.userId, RECIPE_SETTING_KEY.outputLanguage),
        );
        // 예산과 턴과 마감은 잡이 하는 일의 크기에서 나오므로 모델을 바꿔도 이 기능이 그대로 갖는다.
        const model = chosenJobModel(await this.repository.readSetting(job.userId, RECIPE_SETTING_KEY.anthropicModel), AGENT.recipeScan.id);
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
            ...(model !== undefined ? { model } : {}),
            prompt,
            ...(input.userPrompt !== undefined ? { userPrompt: input.userPrompt } : {}),
        };
    }
}
