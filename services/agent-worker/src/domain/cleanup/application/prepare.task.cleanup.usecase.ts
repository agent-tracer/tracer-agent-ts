import type { ResolvedAgentPrompt } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import { chosenJobModel, normalizeOutputLanguage, type OutputLanguage } from "~agent-worker/support/output.language.js";
import { JOB_KIND, JOB_STATUS } from "~agent-worker/support/job.const.js";
import { clampInt } from "~agent-worker/support/clamp.js";
import { buildCleanupCandidates, type CleanupCandidate } from "../model/cleanup.candidate.model.js";
import { CLEANUP_SETTING_KEY } from "../model/cleanup.const.js";
import { JobAlreadySettledError, JobNotFoundError, MissingApiKeyError } from "../model/cleanup.error.js";
import { resolveCleanupPromptPin } from "../model/cleanup.prompt.js";
import type { PromptSourcePort } from "~agent-worker/support/prompt.source.port.js";
import { AGENT } from "~agent-worker/support/agent.const.js";
import type { CleanupAgentPort } from "../port/cleanup.agent.port.js";
import type { JobNotificationPort } from "~agent-worker/support/job.notification.port.js";
import type { CleanupRepositoryPort } from "../port/cleanup.repository.port.js";

const DEFAULT_MAX_SUGGESTIONS = 20;
const MAX_SUGGESTIONS_CAP = 50;

export interface TaskCleanupInput {
    readonly jobId: string;
    readonly maxSuggestions?: number;
}

export interface TaskCleanupPrep {
    readonly jobId: string;
    readonly userId: string;
    readonly language: OutputLanguage;
    readonly maxSuggestions: number;
    readonly candidates: readonly CleanupCandidate[];
    readonly truncated: boolean;
    readonly tasksScanned: number;
    readonly prompt: ResolvedAgentPrompt;
    readonly model?: string;
}

/** 후보를 결정론적으로 계산하고 잡을 실행 상태로 올린 뒤 실행 인자를 확정한다. */
export class PrepareTaskCleanupUsecase {
    constructor(
        private readonly repository: CleanupRepositoryPort,
        private readonly agent: CleanupAgentPort,
        private readonly notification: JobNotificationPort,
        private readonly clock: IClock,
        private readonly prompts: PromptSourcePort,
    ) {}

    async execute(input: TaskCleanupInput): Promise<TaskCleanupPrep> {
        const job = await this.repository.findJob(input.jobId);
        if (job === null) throw new JobNotFoundError(input.jobId);

        const language = normalizeOutputLanguage(
            await this.repository.readSetting(job.userId, CLEANUP_SETTING_KEY.outputLanguage),
        );
        // 예산과 턴과 마감은 잡이 하는 일의 크기에서 나오므로 모델을 바꿔도 이 기능이 그대로 갖는다.
        const model = chosenJobModel(await this.repository.readSetting(job.userId, CLEANUP_SETTING_KEY.anthropicModel), AGENT.taskCleanup.id);
        const prompt = resolveCleanupPromptPin(await this.prompts.resolve(AGENT.taskCleanup.id));

        // 전이 뒤에 자격을 보면 화면이 실행 중을 한 번 보고 실패로 뒤집히므로 앞에서 본다.
        if (this.agent.requiresLocalApiKey()) {
            const apiKey = await this.repository.readSetting(job.userId, CLEANUP_SETTING_KEY.anthropicApiKey);
            if (apiKey === null) throw new MissingApiKeyError(CLEANUP_SETTING_KEY.anthropicApiKey);
        }

        const now = this.clock.now();
        if (!(await this.repository.startJob(job.id, now))) throw new JobAlreadySettledError(job.id);
        await this.notification.jobUpdated(job.userId, {
            jobId: job.id,
            kind: JOB_KIND.taskCleanup,
            status: JOB_STATUS.running,
        });
        const maxSuggestions = await this.resolveMaxSuggestions(job.userId, input.maxSuggestions);

        const batch = await this.repository.loadScanBatch(job.userId);
        const candidates = buildCleanupCandidates({
            tasks: batch.tasks,
            activeChildParentIds: batch.activeChildParentIds,
            now,
        });

        return {
            jobId: job.id,
            userId: job.userId,
            language,
            ...(model !== undefined ? { model } : {}),
            maxSuggestions,
            candidates,
            truncated: batch.truncated,
            tasksScanned: batch.tasksScanned,
            prompt,
        };
    }

    private async resolveMaxSuggestions(userId: string, requested: number | undefined): Promise<number> {
        if (requested !== undefined) return clampInt(requested, DEFAULT_MAX_SUGGESTIONS, 1, MAX_SUGGESTIONS_CAP);
        const raw = await this.repository.readSetting(userId, CLEANUP_SETTING_KEY.maxSuggestions);
        const parsed = raw !== null ? Number.parseInt(raw, 10) : Number.NaN;
        return clampInt(parsed, DEFAULT_MAX_SUGGESTIONS, 1, MAX_SUGGESTIONS_CAP);
    }
}
