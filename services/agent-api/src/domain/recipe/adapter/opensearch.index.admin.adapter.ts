import type { OpenSearchClient } from "~agent-api/config/opensearch.client.js";
import type { SearchIndexDefinition } from "~agent-api/domain/recipe/model/recipe.index.js";
import type { SearchIndexAdminPort } from "~agent-api/domain/recipe/port/search.index.admin.port.js";

/** 없는 색인과 없는 별칭을 물었을 때 색인이 내는 상태다. */
const NOT_FOUND_STATUS = "404";

/** 같은 색인을 두 축이 동시에 세울 때 진 쪽이 받는 사유다. */
const ALREADY_EXISTS_REASON = "resource_already_exists_exception";

function isNotFound(error: unknown): boolean {
    return String(error).includes(NOT_FOUND_STATUS);
}

function isAlreadyExists(error: unknown): boolean {
    return String(error).includes(ALREADY_EXISTS_REASON);
}

/** 계약이 선언한 본문으로 레시피 색인을 세우며 이미 서 있으면 아무것도 하지 않는다. */
export class OpenSearchIndexAdminAdapter implements SearchIndexAdminPort {
    constructor(private readonly client: OpenSearchClient) {}

    async ensureIndex(definition: SearchIndexDefinition): Promise<void> {
        if (await this.indexExists(definition.index)) return;
        // 한 별칭이 두 색인을 가리키면 쓰기도 별칭 교체도 막히므로 이미 붙어 있는 별칭은 다시 붙이지 않는다.
        const attachAlias = !(await this.aliasExists(definition.alias));
        try {
            await this.client.request("PUT", `/${definition.index}`, {
                settings: definition.settings,
                ...(attachAlias ? { aliases: { [definition.alias]: {} } } : {}),
                mappings: definition.mappings,
            });
        } catch (error) {
            // 두 축이 같은 색인을 동시에 세우면 늦은 쪽은 먼저 세워진 색인을 그대로 쓴다.
            if (!isAlreadyExists(error)) throw error;
        }
    }

    private async indexExists(index: string): Promise<boolean> {
        return this.found(`/${index}`);
    }

    private async aliasExists(alias: string): Promise<boolean> {
        return this.found(`/_alias/${alias}`);
    }

    /** 닿지 못한 것을 없는 것으로 읽으면 색인을 세우는 판단이 거짓을 근거로 삼는다. */
    private async found(path: string): Promise<boolean> {
        try {
            await this.client.request("GET", path);
            return true;
        } catch (error) {
            if (isNotFound(error)) return false;
            throw error;
        }
    }
}
