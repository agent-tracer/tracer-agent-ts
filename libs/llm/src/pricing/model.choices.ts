import { featureModels, loadLlmCatalog } from "~llm/pricing/llm.catalog.schema.js";
import { readContractJson } from "~llm/support/contract.js";

interface SettingsExecution {
    readonly envelope: { readonly model: { readonly kinds: readonly string[] } };
}

interface JobKinds {
    readonly kinds: Readonly<Record<string, { readonly agent: string }>>;
}

/** 설정이 고른 모델이 실리는 잡의 기능 이름이며 계약이 그 종류를 갖는다. */
function settingFeatures(): readonly string[] {
    const { kinds } = readContractJson<SettingsExecution>("agent/shared/settings.execution.json").envelope.model;
    const declared = readContractJson<JobKinds>("wire/job.kinds.json").kinds;
    return kinds.flatMap((kind) => (declared[kind] === undefined ? [] : [declared[kind].agent]));
}

// 설정이 하나뿐이므로 어느 한 종류라도 허용하지 않는 모델은 골라도 그 종류에 걸리지 않는다.
export function offeredModelIds(): ReadonlySet<string> {
    const lists = settingFeatures().map((feature) => featureModels(feature)?.allowed ?? []);
    const [first, ...rest] = lists;
    if (first === undefined) return new Set(Object.keys(loadLlmCatalog().models));
    return new Set(first.filter((id) => rest.every((allowed) => allowed.includes(id))));
}
