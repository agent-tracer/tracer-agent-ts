import type { ResolvedAgentPrompt } from "@tracer-agent/llm";
import type { IClock } from "@tracer-agent/platform";
import { normalizeOutputLanguage, type OutputLanguage } from "~agent-worker/support/output.language.js";
import { JOB_STATUS } from "~agent-worker/support/job.const.js";
import { clampInt } from "~agent-worker/support/clamp.js";
import { buildCleanupCandidates, type CleanupCandidate } from "../model/cleanup.candidate.model.js";
import { CLEANUP_SETTING_KEY } from "../model/cleanup.const.js";
import { JobAlreadySettledError, JobNotFoundError, MissingApiKeyError } from "../model/cleanup.error.js";
import { resolveCleanupPromptPin } from "../model/cleanup.prompt.js";
import type { CleanupAgentPort } from "../port/cleanup.agent.port.js";
import type { CleanupNotificationPort } from "../port/cleanup.notification.port.js";
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
        private readonly notification: CleanupNotificationPort,
        private readonly clock: IClock,
    ) {}

    async execute(input: TaskCleanupInput): Promise<TaskCleanupPrep> {
        const job = await this.repository.findJob(input.jobId);
        if (job === null) throw new JobNotFoundError(input.jobId);

        const language = normalizeOutputLanguage(
            await this.repository.readSetting(job.userId, CLEANUP_SETTING_KEY.outputLanguage),
        );
        const prompt = resolveCleanupPromptPin(language);

        const now = this.clock.now();
        if (!(await this.repository.startJob(job.id, now))) throw new JobAlreadySettledError(job.id);
        await this.notification.jobUpdated(job.userId, { jobId: job.id, status: JOB_STATUS.running });

        if (this.agent.requiresLocalApiKey()) {
            const apiKey = await this.repository.readSetting(job.userId, CLEANUP_SETTING_KEY.anthropicApiKey);
            if (apiKey === null) throw new MissingApiKeyError(CLEANUP_SETTING_KEY.anthropicApiKey);
        }
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
