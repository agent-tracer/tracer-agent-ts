import type { IClock } from "@tracer-agent/platform";
import { AGENT } from "~agent-worker/support/agent.const.js";
import { chosenJobModel, normalizeOutputLanguage } from "~agent-worker/support/output.language.js";
import { JOB_KIND, JOB_STATUS } from "~agent-worker/support/job.const.js";
import { TITLE_SETTING_KEY } from "~agent-worker/domain/title/model/title.const.js";
import {
    JobAlreadySettledError,
    JobNotFoundError,
    MissingApiKeyError,
    TaskHasNoEventsError,
    TaskNotFoundError,
} from "~agent-worker/domain/title/model/title.error.js";
import type {
    TitleSuggestionInput,
    TitleSuggestionPrep,
} from "~agent-worker/domain/title/model/title.job.model.js";
import { resolveTitlePromptPin } from "~agent-worker/domain/title/model/title.prompt.js";
import type { PromptSourcePort } from "~agent-worker/support/prompt.source.port.js";
import type { TitleAgentPort } from "~agent-worker/domain/title/port/title.agent.port.js";
import type { JobNotificationPort } from "~agent-worker/support/job.notification.port.js";
import type { TitleRepositoryPort } from "~agent-worker/domain/title/port/title.repository.port.js";

/** 대화 컨텍스트를 모으고 잡을 실행 상태로 올린 뒤 실행 인자를 확정한다. */
export class PrepareTitleSuggestionUsecase {
    constructor(
        private readonly repository: TitleRepositoryPort,
        private readonly agent: TitleAgentPort,
        private readonly notification: JobNotificationPort,
        private readonly clock: IClock,
        private readonly prompts: PromptSourcePort,
    ) {}

    async execute(input: TitleSuggestionInput): Promise<TitleSuggestionPrep> {
        const job = await this.repository.findJob(input.jobId);
        if (job === null) throw new JobNotFoundError(input.jobId);

        const found = await this.repository.findTaskContext(job.userId, input.taskId);
        if (found === null || !found.ownedByUser || found.context === null) {
            throw new TaskNotFoundError(input.taskId);
        }
        if (found.totalEventCount === 0) throw new TaskHasNoEventsError(input.taskId);

        const language = normalizeOutputLanguage(
            await this.repository.readSetting(job.userId, TITLE_SETTING_KEY.outputLanguage),
        );
        // 예산과 턴과 마감은 잡이 하는 일의 크기에서 나오므로 모델을 바꿔도 이 기능이 그대로 갖는다.
        const model = chosenJobModel(await this.repository.readSetting(job.userId, TITLE_SETTING_KEY.anthropicModel), AGENT.titleSuggestion.id);
        const prompt = resolveTitlePromptPin(await this.prompts.resolve(AGENT.titleSuggestion.id));

        const now = this.clock.now();
        if (!(await this.repository.startJob(job.id, now))) throw new JobAlreadySettledError(job.id);
        await this.notification.jobUpdated(job.userId, {
            jobId: job.id,
            kind: JOB_KIND.titleSuggestion,
            status: JOB_STATUS.running,
            taskId: input.taskId,
        });

        if (this.agent.requiresLocalApiKey()) {
            const apiKey = await this.repository.readSetting(job.userId, TITLE_SETTING_KEY.anthropicApiKey);
            if (apiKey === null) throw new MissingApiKeyError(TITLE_SETTING_KEY.anthropicApiKey);
        }
        return {
            jobId: job.id,
            userId: job.userId,
            taskId: input.taskId,
            language,
            ...(model !== undefined ? { model } : {}),
            currentTitle: found.context.title,
            context: found.context,
            prompt,
        };
    }
}
