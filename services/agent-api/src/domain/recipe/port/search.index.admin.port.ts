import type { SearchIndexDefinition } from "~agent-api/domain/recipe/model/recipe.index.js";

export const SEARCH_INDEX_ADMIN = Symbol("SearchIndexAdmin");

/** 검색 색인을 세우는 포트다. */
export interface SearchIndexAdminPort {
    /** 이미 서 있는 색인은 그대로 두고 없을 때만 계약의 본문으로 세운다. */
    ensureIndex(definition: SearchIndexDefinition): Promise<void>;
}
