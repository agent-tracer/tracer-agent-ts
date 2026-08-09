import type { OpenSearchClient } from "~agent-api/config/opensearch.client.js";
import type { SearchIndexWriterPort } from "~agent-api/domain/recipe/port/search.outbox.drain.port.js";

/** 없는 문서를 지우려는 요청에 색인이 내는 상태이며 배출에서는 성공과 같은 결말이다. */
const NOT_FOUND_STATUS = "404";

/** 문서 식별자가 원장의 식별자와 같으므로 같은 행을 여러 번 배출해도 문서가 늘지 않는다. */
export class OpenSearchIndexWriterAdapter implements SearchIndexWriterPort {
    constructor(private readonly client: OpenSearchClient) {}

    async indexDocument(alias: string, documentId: string, document: Record<string, unknown>): Promise<void> {
        await this.client.request("PUT", `/${alias}/_doc/${encodeURIComponent(documentId)}`, document);
    }

    async deleteDocument(alias: string, documentId: string): Promise<void> {
        try {
            await this.client.request("DELETE", `/${alias}/_doc/${encodeURIComponent(documentId)}`);
        } catch (error) {
            // 이미 없는 문서를 지우는 것은 지운 상태에 이르렀다는 뜻이므로 실패로 세지 않는다.
            if (!String(error).includes(NOT_FOUND_STATUS)) throw error;
        }
    }
}
