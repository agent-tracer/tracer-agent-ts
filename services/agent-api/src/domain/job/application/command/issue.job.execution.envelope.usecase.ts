import { Inject, Injectable } from "@nestjs/common";
import { featureLimits, featureModels, isPricedModel, wireModelRates } from "@tracer-agent/llm";
import {
    JOB_API_KEY_SETTING,
    JOB_FEATURE_BY_KIND,
    JOB_MODEL_SETTING,
    type WorkflowJobKind,
} from "~agent-api/domain/job/model/job.const.js";
import { LlmKeyMissingError } from "~agent-api/domain/job/model/job.errors.js";
import type { JobExecutionEnvelope } from "~agent-api/domain/job/model/job.execution.envelope.js";
import { JOB_SETTING_READER, type JobSettingReaderPort } from "~agent-api/domain/job/port/setting.reader.port.js";

/** 실행기가 카탈로그도 자격도 지어내지 않도록, 한 시도가 쓸 값 전부를 이 서비스가 만들어 건넨다. */
@Injectable()
export class IssueJobExecutionEnvelopeUseCase {
    constructor(
        @Inject(JOB_SETTING_READER) private readonly settings: JobSettingReaderPort,
    ) {}

    async execute(kind: WorkflowJobKind, userId: string): Promise<JobExecutionEnvelope> {
        const apiKey = await this.settings.findByScopeAndKey(userId, JOB_API_KEY_SETTING);
        if (apiKey === null || apiKey.length === 0) throw new LlmKeyMissingError();

        const feature = JOB_FEATURE_BY_KIND[kind];
        const models = featureModels(feature)!;
        const limits = featureLimits(feature);
        // 예산과 턴과 마감은 잡이 하는 일의 크기에서 나오므로 모델을 바꿔도 종류가 그대로 갖는다.
        const chosen = await this.settings.findByScopeAndKey(userId, JOB_MODEL_SETTING);
        return {
            model: chosen !== null && isPricedModel(chosen) ? chosen : models.default,
            fallbackModel: models.fallback ?? null,
            apiKey,
            modelRates: wireModelRates(),
            limits: {
                budgetUsd: limits.budgetUsd,
                maxTurns: limits.maxTurns,
                maxOutputTokens: limits.maxOutputTokens,
            },
            deadlineMs: limits.deadlineMs,
        };
    }
}
