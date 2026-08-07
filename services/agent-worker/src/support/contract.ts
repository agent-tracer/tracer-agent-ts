import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { ContractToolFile } from "@tracer-agent/llm";
import type { PromptDeclarationFile } from "./agent.prompt.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/** 이 구현이 고정한 계약 저장소의 뿌리이며 명세와 어휘는 전부 이 아래에서 읽는다. */
export const CONTRACT_ROOT = path.join(REPO_ROOT, "contract");

/** 계약 뿌리를 기준으로 한 상대 경로의 JSON 파일 하나를 읽는다. */
export function readContractJson<T>(relative: string): T {
    return JSON.parse(readFileSync(path.join(CONTRACT_ROOT, relative), "utf8")) as T;
}

/** 계약 뿌리를 기준으로 한 상대 경로의 YAML 파일 하나를 읽는다. */
export function readContractYaml<T>(relative: string): T {
    return parse(readFileSync(path.join(CONTRACT_ROOT, relative), "utf8")) as T;
}

/** 워커가 여는 SDK 지표 창구이며 두 축이 같은 자리에 같은 단위로 내도록 계약이 값을 갖는다. */
export interface WorkerSdkMetricsDeclaration {
    readonly bindAddress: string;
    readonly port: number;
    readonly path: string;
    readonly durationUnit: string;
    readonly countersTotalSuffix: boolean;
    readonly unitSuffix: boolean;
}

export function readWorkerSdkMetrics(): WorkerSdkMetricsDeclaration {
    return readContractYaml<{ readonly workerSdkMetrics: WorkerSdkMetricsDeclaration }>(
        "workflow/metrics.yaml",
    ).workerSdkMetrics;
}

/** 축을 싣는 두 이름이며 계측이 쓰는 속성과 지표 창구가 직접 싣는 라벨을 나눠 갖는다. */
export interface AxisLabelDeclaration {
    readonly attributeKey: string;
    readonly labelName: string;
}

export function readAxisLabel(): AxisLabelDeclaration {
    return readContractYaml<{ readonly labels: { readonly axis: AxisLabelDeclaration } }>(
        "workflow/metrics.yaml",
    ).labels.axis;
}

/** 에이전트 하나의 조각과 템플릿 선언을 읽는다. */
export function readAgentPrompt(agentName: string): PromptDeclarationFile {
    return readContractJson<PromptDeclarationFile>(`agent/${agentName}/prompt.json`);
}

/** 에이전트 하나의 도구와 인자와 상한을 읽는다. */
export function readAgentTools<T extends ContractToolFile>(agentName: string): T {
    return readContractJson<T>(`agent/${agentName}/tool.json`);
}

/** 에이전트 하나의 구조화 출력 스키마를 읽는다. */
export function readAgentOutput(agentName: string): { readonly schema: Record<string, unknown> } {
    return readContractJson<{ readonly schema: Record<string, unknown> }>(`agent/${agentName}/output.json`);
}

/** 조립된 프롬프트가 출력 언어마다 실어야 하는 조각과 그 언어별 변형을 계약이 적은 것이다. */
export interface AgentLanguageCases {
    readonly fragment: string;
    readonly cases: readonly {
        readonly input: { readonly language?: string };
        readonly expect: { readonly variant: string };
    }[];
}

/** 에이전트 하나의 판정 케이스이며 어느 절을 갖는지는 에이전트마다 다르다. */
/** 적합성 케이스 하나를 이름으로 읽는다. */
export function readCase<T>(name: string): T {
    return readContractJson<T>(`conformance/cases/${name}.json`);
}

export function readAgentCases<T>(agentName: string): T {
    return readContractJson<T>(`agent/${agentName}/cases.json`);
}

/** 실행기가 받은 조각을 원장에 적는 리듬이며 두 구현체가 같은 값을 읽는다. */
export interface ChatDraftRules {
    readonly intervalMs: number;
    readonly edge: string;
}

export function readChatDraftRules(): ChatDraftRules {
    const declared = readCase<{ readonly stream: { readonly draft: ChatDraftRules } }>("chat.query")
        .stream.draft;
    return { intervalMs: declared.intervalMs, edge: declared.edge };
}

/** 산출물 창구 하나의 요청 본문에 실릴 수 있는 칸이다. */
export interface TracerOutputWindow {
    readonly method: string;
    readonly path: string;
    readonly status: number;
    readonly body: { readonly required: readonly string[]; readonly optional: readonly string[] };
    readonly data: Readonly<Record<string, string>>;
}

/** 산출물 한 건을 만드는 요청 항목의 칸이다. */
export interface TracerOutputDraft {
    readonly required: readonly string[];
    readonly optional: readonly string[];
}

/** 에이전트가 만드는 산출물의 창구와 칸과 멱등 규칙을 계약이 적은 그대로 담는다. */
export interface TracerOutputsCase {
    readonly shapes: Readonly<Record<string, { readonly fields: readonly string[] }>>;
    readonly drafts: { readonly recipe: TracerOutputDraft; readonly cleanupSuggestion: TracerOutputDraft };
    readonly windows: readonly TracerOutputWindow[];
    readonly idempotency: {
        readonly recipes: { readonly key: string };
        readonly cleanupSuggestions: { readonly key: string };
    };
}

export function readTracerOutputsCase(): TracerOutputsCase {
    return readContractJson<TracerOutputsCase>("conformance/cases/tracer.outputs.json");
}

/** 계약이 usage의 model 칸 하나에 고정한 값의 규칙이다. */
export interface JobUsageModelRule {
    readonly value: string;
    readonly example: string;
    readonly forbidden: string;
    readonly rateKey: string;
}

/** 계약이 끝내지 못한 잡의 usage 한 칸에 고정한 모양이다. */
export interface JobFailedUsageRule {
    readonly shape: string;
    readonly fields: readonly string[];
}

export function readJobFailedUsageRule(): JobFailedUsageRule {
    return readContractJson<{
        readonly response: { readonly usage: { readonly failed: JobFailedUsageRule } };
    }>("conformance/cases/job.intake.json").response.usage.failed;
}

export function readJobUsageModelRule(): JobUsageModelRule {
    return readContractJson<{ readonly response: { readonly usage: { readonly model: JobUsageModelRule } } }>(
        "conformance/cases/job.intake.json",
    ).response.usage.model;
}

/** 서비스를 넘어 오가는 알림 토픽의 이름과 봉투와 종류를 계약이 적은 그대로 담는다. */
export interface NotificationTopicDeclaration {
    readonly name: string;
    readonly key: string;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly types: {
        readonly jobUpdated: {
            readonly name: string;
            readonly payload: Readonly<Record<string, { readonly required: boolean }>>;
        };
    };
}

export function readNotificationTopic(): NotificationTopicDeclaration {
    return readContractJson<{ readonly notifications: NotificationTopicDeclaration }>("wire/topics.json")
        .notifications;
}

/** 잡 갱신 알림이 반드시 실어야 한다고 계약이 적은 칸이다. */
export function requiredJobNotificationFields(): string[] {
    const { payload } = readNotificationTopic().types.jobUpdated;
    return Object.entries(payload)
        .filter(([, rule]) => rule.required)
        .map(([field]) => field);
}
