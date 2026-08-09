import type { SearchOutboxRow } from "~agent-api/domain/recipe/model/search.outbox.model.js";
import type { RecipeRepositoryPort } from "~agent-api/domain/recipe/port/recipe.repository.port.js";

export const SEARCH_OUTBOX_DRAIN = Symbol("SearchOutboxDrain");
export const SEARCH_INDEX_WRITER = Symbol("SearchIndexWriter");

/** 색인 반영 요청 줄을 배출기가 읽고 지우고 실패를 적는 포트다. */
export interface SearchOutboxDrainRepositoryPort {
    findBatch(limit: number): Promise<SearchOutboxRow[]>;
    delete(id: string): Promise<void>;
    markFailed(id: string, attempts: number, error: string): Promise<void>;
}

/** 배출이 한 번에 하나만 돌도록 원장의 자문 잠금 뒤에서 저장소 묶음을 여는 포트다. */
export interface SearchOutboxDrainPort {
    /** 잠금을 얻지 못하면 일을 하지 않고 null 을 낸다. */
    withLock<T>(work: (repositories: SearchOutboxDrainRepositories) => Promise<T>): Promise<T | null>;
}

/** 배출 한 번이 여는 저장소 경계다. */
export interface SearchOutboxDrainRepositories {
    readonly searchOutbox: SearchOutboxDrainRepositoryPort;
    readonly recipes: RecipeRepositoryPort;
}

/** 배출 한 번을 부르는 자리이며 주기를 세우는 쪽은 이 포트만 안다. */
export interface SearchOutboxDrainRunnerPort {
    runOnce(): Promise<number>;
}

/** 검색 색인에 문서를 덮어쓰거나 지우는 포트다. */
export interface SearchIndexWriterPort {
    indexDocument(alias: string, documentId: string, document: Record<string, unknown>): Promise<void>;
    deleteDocument(alias: string, documentId: string): Promise<void>;
}
