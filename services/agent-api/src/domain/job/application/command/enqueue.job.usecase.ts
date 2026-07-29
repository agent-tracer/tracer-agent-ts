import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { JOB_KIND, JOB_STATUS, type JobKind } from "~agent-api/domain/job/model/job.const.js";
import {
    InvalidRuleAnchorError,
    JobIdempotencyConflictError,
    LlmKeyMissingError,
} from "~agent-api/domain/job/model/job.errors.js";
import { Job } from "~agent-api/domain/job/model/job.model.js";
import { mapJob, type JobDto } from "~agent-api/domain/job/model/job.view.model.js";
import { JOB_CLOCK, type ClockPort } from "~agent-api/domain/job/port/clock.port.js";
import { JOB_EVENT_LOG, type JobEventLog } from "~agent-api/domain/job/port/job.event.log.port.js";
import { JOB_ID_GENERATOR, type JobIdGeneratorPort } from "~agent-api/domain/job/port/job.id.generator.port.js";
import { JOB_REPOSITORY, type JobRepositoryPort } from "~agent-api/domain/job/port/job.repository.port.js";
import { LOCAL_CLI_AUTH, type LocalCliAuthPort } from "~agent-api/domain/job/port/local.cli.auth.port.js";
import { RULE_ANCHOR_READER, type RuleAnchorReaderPort } from "~agent-api/domain/job/port/rule.anchor.reader.port.js";
import { JOB_SETTING_READER, type JobSettingReaderPort } from "~agent-api/domain/job/port/setting.reader.port.js";
import { WORKFLOW_DISPATCHER, type WorkflowDispatcherPort } from "~agent-api/domain/job/port/workflow.dispatcher.port.js";

/** 사용자 설정에서 모델 자격을 찾는 키다. */
export const JOB_API_KEY_SETTING = "anthropic.api_key";

export interface EnqueueJobOptions {
    readonly idempotencyKey?: string;
}

/** 잡 하나를 접수해 원장에 적고 워크플로가 도는 종류면 실행을 기동한다. */
@Injectable()
export class EnqueueJobUseCase {
    constructor(
        @Inject(JOB_REPOSITORY) private readonly jobs: JobRepositoryPort,
        @Inject(RULE_ANCHOR_READER) private readonly anchors: RuleAnchorReaderPort,
        @Inject(JOB_SETTING_READER) private readonly settings: JobSettingReaderPort,
        @Inject(WORKFLOW_DISPATCHER) private readonly dispatcher: WorkflowDispatcherPort,
        @Inject(JOB_CLOCK) private readonly clock: ClockPort,
        @Inject(LOCAL_CLI_AUTH) private readonly localCliAuth: LocalCliAuthPort,
        @Inject(JOB_EVENT_LOG) private readonly jobLog: JobEventLog,
        @Inject(JOB_ID_GENERATOR) private readonly idGenerator: JobIdGeneratorPort,
    ) {}

    async execute(
        userId: string,
        kind: JobKind,
        input: Record<string, unknown>,
        options: EnqueueJobOptions = {},
    ): Promise<{ readonly job: JobDto }> {
        if (kind === JOB_KIND.ruleGeneration) await this.validateRuleAnchor(userId, input);
        // 로컬 자격으로 도는 이미지는 API 키가 필요 없어 접수 검사를 건너뛴다.
        if (kind !== JOB_KIND.ruleGeneration && !this.localCliAuth) {
            const apiKey = await this.settings.findByScopeAndKey(userId, JOB_API_KEY_SETTING);
            if (apiKey === null || apiKey.length === 0) {
                this.jobLog.llmKeyMissing({ userId, kind });
                throw new LlmKeyMissingError();
            }
        }

        const idempotencyKey = normalizeIdempotencyKey(options.idempotencyKey);
        const inputHash = idempotencyKey !== undefined ? hashJobInput(input) : undefined;
        const job = Job.create(
            this.idGenerator.next(),
            userId,
            kind,
            input,
            this.clock.now(),
            idempotencyKey !== undefined && inputHash !== undefined
                ? { key: idempotencyKey, inputHash }
                : undefined,
        );
        const saved = await this.saveJob(job, idempotencyKey, inputHash);
        if (saved.created) this.jobLog.enqueued({ userId, jobId: saved.job.id, kind });
        if (!saved.job.runsLocally() && (saved.created || saved.job.status === JOB_STATUS.pending)) {
            await this.dispatcher.start(kind, saved.job.id, userId, saved.job.input);
        }
        return { job: mapJob(saved.job) };
    }

    private async validateRuleAnchor(userId: string, input: Record<string, unknown>): Promise<void> {
        const taskId = readRequiredText(input["taskId"]);
        const anchorEventId = readRequiredText(input["anchorEventId"]);
        if (taskId === null || anchorEventId === null) throw new InvalidRuleAnchorError();
        const anchor = await this.anchors.findById(anchorEventId);
        if (
            anchor === null
            || anchor.userId !== userId
            || anchor.taskId !== taskId
            || !anchor.userMessage
        ) {
            throw new InvalidRuleAnchorError();
        }
    }

    private async saveJob(
        job: Job,
        idempotencyKey: string | undefined,
        inputHash: string | undefined,
    ): Promise<{ readonly job: Job; readonly created: boolean }> {
        if (idempotencyKey === undefined || inputHash === undefined) {
            await this.jobs.upsert(job);
            return { job, created: true };
        }
        try {
            await this.jobs.insert(job);
            return { job, created: true };
        } catch (error) {
            if (!isUniqueViolation(error)) throw error;
        }
        const existing = await this.jobs.findByIdempotency(job.userId, job.kind, idempotencyKey);
        if (existing === null || existing.idempotencyInputHash !== inputHash) {
            this.jobLog.idempotencyConflict({ userId: job.userId, kind: job.kind });
            throw new JobIdempotencyConflictError();
        }
        return { job: existing, created: false };
    }
}

function normalizeIdempotencyKey(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}

function readRequiredText(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function hashJobInput(input: Record<string, unknown>): string {
    return createHash("sha256")
        .update(JSON.stringify(toCanonicalJsonValue(input)), "utf8")
        .digest("hex");
}

function toCanonicalJsonValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(toCanonicalJsonValue);
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .sort(([left], [right]) => left.localeCompare(right))
                .map(([key, child]) => [key, toCanonicalJsonValue(child)]),
        );
    }
    return value;
}

function isUniqueViolation(error: unknown): boolean {
    if (getErrorCode(error) === "23505") return true;
    return getErrorCode((error as { readonly driverError?: unknown } | null)?.driverError) === "23505";
}

function getErrorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) return undefined;
    const code = (error as { readonly code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
}
