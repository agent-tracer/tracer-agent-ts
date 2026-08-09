import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "zod";
import { assertModelEnvelopeVocabulary } from "~llm/model/model.envelope.schema.js";

const rateSchema = z.object({
    label: z.string().min(1),
    input: z.number().positive(),
    output: z.number().positive(),
    cacheWrite: z.number().positive(),
    cacheRead: z.number().positive(),
});

/** 실행 봉투에 실려 실행기로 건너가는 한 기능의 실행 한도이며 추론 노력은 기능이 아니라 모델에 붙으므로 여기 없다. */
const limitsSchema = z.object({
    budgetUsd: z.number().positive(),
    maxTurns: z.number().int().positive(),
    maxOutputTokens: z.number().int().positive(),
    deadlineMs: z.number().int().positive(),
    stallMs: z.number().int().positive().optional(),
    /** 모델별 출력 한도이며 없는 모델은 이 기능의 maxOutputTokens를 그대로 쓴다. */
    maxOutputTokensByModel: z.record(z.number().int().positive()).optional(),
});

const featureSchema = z.object({
    default: z.string().min(1),
    fallback: z.string().min(1).optional(),
    allowed: z.array(z.string().min(1)).min(1),
    limits: limitsSchema.optional(),
});

/** 캐시 쓰기 단가의 배수를 정하는 수명이며 값의 목록은 계약의 model.rates.json 이 갖는다. */
const CACHE_WRITE_TTL_VALUES = ["5m", "1h"] as const;

const catalogSchema = z.object({
    cacheWriteTtl: z.enum(CACHE_WRITE_TTL_VALUES),
    models: z.record(rateSchema),
    features: z.record(featureSchema),
});

/** 백만 토큰당 USD 단가이며 캐시 쓰기와 읽기는 입력 단가에서 파생된 별도 값이다. */
export type ModelRate = z.infer<typeof rateSchema>;
export type FeatureModels = z.infer<typeof featureSchema>;
export type FeatureLimits = z.infer<typeof limitsSchema>;
export type LlmCatalog = z.infer<typeof catalogSchema>;

/** 실행 봉투에 실려 다른 배포 단위로 건너가는 단가이며 사람이 읽는 이름은 빼고 숫자만 담는다. */
export type WireModelRate = Omit<ModelRate, "label">;

const PACKAGE_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(PACKAGE_ROOT, "../../../..");

function catalogPath(): string {
    return process.env["LLM_CATALOG_PATH"] ?? path.join(REPO_ROOT, "llm.yaml");
}

function readCatalog(): LlmCatalog {
    assertModelEnvelopeVocabulary();
    const file = catalogPath();
    const parsed: unknown = parse(fs.readFileSync(file, "utf8"));
    const catalog = catalogSchema.parse(parsed);
    // 기능이 카탈로그에 없는 모델을 가리키면 그 기능은 단가를 몰라 예산을 집행할 수 없다.
    for (const [feature, models] of Object.entries(catalog.features)) {
        for (const id of [models.default, ...(models.fallback !== undefined ? [models.fallback] : []), ...models.allowed]) {
            if (catalog.models[id] === undefined) {
                throw new Error(`llm.yaml: feature ${feature} references unpriced model ${id}`);
            }
        }
    }
    return catalog;
}

let cached: LlmCatalog | null = null;

/** 모델과 단가와 기능별 허용 목록의 정본을 읽어 검증한 결과를 돌려준다. */
export function loadLlmCatalog(): LlmCatalog {
    cached ??= readCatalog();
    return cached;
}

/** 이 축의 실행이 요청하는 캐시 수명이며 표의 캐시 단가는 이 수명의 배수를 따른다. */
export function cacheWriteTtl(): (typeof CACHE_WRITE_TTL_VALUES)[number] {
    return loadLlmCatalog().cacheWriteTtl;
}

/** 단가를 아는 모델인지 답하며, 모르는 모델은 접수 단계에서 막는다. */
export function isPricedModel(model: string): boolean {
    return loadLlmCatalog().models[model] !== undefined;
}

export function modelRate(model: string): ModelRate | null {
    const alias = modelAlias(model);
    return alias === null ? null : (loadLlmCatalog().models[alias] ?? null);
}

/** 프로바이더는 별칭으로 부른 요청에도 날짜가 붙은 구체 버전 이름으로 응답하므로 그 이름을 카탈로그의 별칭으로 되돌린다. */
export function modelAlias(model: string): string | null {
    const models = loadLlmCatalog().models;
    if (models[model] !== undefined) return model;
    const prefixed = Object.keys(models).filter((id) => model.startsWith(`${id}-`));
    if (prefixed.length === 0) return null;
    return prefixed.reduce((left, right) => (right.length > left.length ? right : left));
}

/** 실행기는 자기 단가표를 갖지 않으므로 봉투에 실어 보낼 단가만 뽑아 준다. */
export function wireModelRates(): Readonly<Record<string, WireModelRate>> {
    return Object.fromEntries(
        Object.entries(loadLlmCatalog().models).map(([id, { label: _label, ...rate }]) => [id, rate]),
    );
}

/** 한 기능이 쓸 수 있는 모델 목록이며 설정 화면과 접수 검증이 같은 값을 본다. */
export function featureModels(feature: string): FeatureModels | null {
    return loadLlmCatalog().features[feature] ?? null;
}

/** 한 기능의 실행 한도이며 한도를 적지 않은 기능은 이 창구로 집행되지 않는다. */
export function featureLimits(feature: string): FeatureLimits {
    const limits = loadLlmCatalog().features[feature]?.limits;
    if (limits === undefined) throw new Error(`llm.yaml: feature ${feature} has no limits`);
    return limits;
}

/** 모델별 출력 한도가 있으면 그 값을, 없으면 기능의 출력 한도를 낸다. */
export function modelMaxOutputTokens(feature: string, model: string): number {
    const limits = featureLimits(feature);
    const alias = modelAlias(model) ?? model;
    return limits.maxOutputTokensByModel?.[alias] ?? limits.maxOutputTokens;
}
