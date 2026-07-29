import type { ModelOption } from "~agent-api/domain/settings/model/setting.model.js";

export const MODEL_CATALOG = Symbol("ModelCatalog");

/** 단가를 아는 모델만 담으며 설정 화면과 저장 검증이 이 목록 하나를 함께 본다. */
export interface ModelCatalogPort {
    list(): readonly ModelOption[];
}
