/** 검색 색인을 부르는 최소 전송이며 색인 클라이언트 의존성을 더하지 않으려고 HTTP 를 그대로 쓴다. */
export class OpenSearchClient {
    private readonly baseUrl: string;

    constructor(baseUrl: string, private readonly send: typeof fetch = fetch) {
        this.baseUrl = baseUrl.replace(/\/+$/, "");
    }

    /** 2xx 가 아니면 부른 쪽이 재시도할 수 있게 던진다. */
    async request(method: string, path: string, body?: unknown): Promise<unknown> {
        const response = await this.send(`${this.baseUrl}${path}`, {
            method,
            headers: body === undefined ? {} : { "content-type": "application/json" },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await response.text();
        if (!response.ok) {
            throw new Error(`opensearch ${method} ${path} responded ${String(response.status)} ${text}`);
        }
        return text.length === 0 ? null : (JSON.parse(text) as unknown);
    }
}

/** 색인을 담은 OpenSearch 의 주소는 배포가 정하며 지정이 없으면 개발 기본값을 쓴다. */
export function resolveOpenSearchUrl(): string {
    return process.env["OPENSEARCH_URL"] ?? "http://127.0.0.1:9200";
}
