/** 레시피 슬라이스가 검색 엔진에 요구하는 표면이다. */
export interface RecipeSearchClient {
    search(request: { readonly index: string; readonly body: Record<string, unknown> }): Promise<unknown>;
}
