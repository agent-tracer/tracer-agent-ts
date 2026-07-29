/** 검색 엔진 한 번의 질의이며 색인 이름과 질의 본문을 그대로 싣는다. */
export interface SearchRequest {
    readonly index: string;
    readonly body: Record<string, unknown>;
}

/** 레시피 도구가 검색 엔진에 요구하는 표면이다. */
export interface SearchClient {
    search(request: SearchRequest): Promise<unknown>;
}

/** 검색 엔진의 기점이며 배포가 정한다. */
function resolveSearchNode(): string {
    return process.env["OPENSEARCH_NODE"] ?? "http://127.0.0.1:9200";
}

export function createSearchClient(): SearchClient {
    const node = resolveSearchNode();
    return {
        async search(request) {
            const response = await fetch(`${node}/${request.index}/_search`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(request.body),
            });
            return (await response.json()) as unknown;
        },
    };
}
