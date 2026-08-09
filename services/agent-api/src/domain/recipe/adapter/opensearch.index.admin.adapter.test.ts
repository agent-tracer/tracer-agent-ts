import { describe, expect, it } from "vitest";
import { OpenSearchClient } from "~agent-api/config/opensearch.client.js";
import { RECIPES_INDEX_DEFINITION } from "~agent-api/domain/recipe/model/recipe.index.js";
import { OpenSearchIndexAdminAdapter } from "./opensearch.index.admin.adapter.js";

const BASE_URL = "http://opensearch.test";

interface Call {
    readonly method: string;
    readonly path: string;
    readonly body: unknown;
}

/** 색인 서버의 대역이며 경로마다 낼 상태를 미리 정한다. */
class FakeSearchServer {
    readonly calls: Call[] = [];

    // 실물이 하는 매핑 검증과 별칭 이름 충돌 거절은 흉내 내지 않는다.
    constructor(private readonly replies: Readonly<Record<string, { status: number; body?: unknown }>>) {}

    readonly fetch: typeof fetch = (input, init) => {
        const path = (input as string).slice(BASE_URL.length);
        const method = init?.method ?? "GET";
        this.calls.push({
            method,
            path,
            body: init?.body === undefined ? undefined : JSON.parse(init.body as string),
        });
        // 정하지 않은 조회는 없는 것으로, 정하지 않은 생성은 받아들인 것으로 답한다.
        const fallback = method === "GET" ? { status: 404, body: { status: 404 } } : { status: 200 };
        const reply = this.replies[`${method} ${path}`] ?? fallback;
        return Promise.resolve(
            new Response(JSON.stringify(reply.body ?? {}), { status: reply.status }),
        );
    };
}

function adapterOver(server: FakeSearchServer): OpenSearchIndexAdminAdapter {
    return new OpenSearchIndexAdminAdapter(new OpenSearchClient(BASE_URL, server.fetch));
}

function creations(server: FakeSearchServer): readonly Call[] {
    return server.calls.filter((call) => call.method === "PUT");
}

describe("레시피 색인을 세우는 어댑터", () => {
    it("색인이 없으면 계약의 본문으로 세우고 별칭을 함께 붙인다", async () => {
        const server = new FakeSearchServer({});

        await adapterOver(server).ensureIndex(RECIPES_INDEX_DEFINITION);

        expect(creations(server)).toEqual([
            {
                method: "PUT",
                path: `/${RECIPES_INDEX_DEFINITION.index}`,
                body: {
                    settings: RECIPES_INDEX_DEFINITION.settings,
                    aliases: { [RECIPES_INDEX_DEFINITION.alias]: {} },
                    mappings: RECIPES_INDEX_DEFINITION.mappings,
                },
            },
        ]);
    });

    it("색인이 이미 서 있으면 다시 세우지 않는다", async () => {
        const server = new FakeSearchServer({ [`GET /${RECIPES_INDEX_DEFINITION.index}`]: { status: 200 } });

        await adapterOver(server).ensureIndex(RECIPES_INDEX_DEFINITION);

        expect(creations(server)).toEqual([]);
    });

    it("별칭이 이미 어딘가에 붙어 있으면 세우는 색인에 다시 붙이지 않는다", async () => {
        const server = new FakeSearchServer({
            [`GET /_alias/${RECIPES_INDEX_DEFINITION.alias}`]: { status: 200, body: { "recipes-v1": {} } },
        });

        await adapterOver(server).ensureIndex(RECIPES_INDEX_DEFINITION);

        expect(creations(server)[0]?.body).toEqual({
            settings: RECIPES_INDEX_DEFINITION.settings,
            mappings: RECIPES_INDEX_DEFINITION.mappings,
        });
    });

    it("다른 축이 같은 색인을 먼저 세웠다는 사유는 실패로 세지 않는다", async () => {
        const server = new FakeSearchServer({
            [`PUT /${RECIPES_INDEX_DEFINITION.index}`]: {
                status: 400,
                body: { error: { type: "resource_already_exists_exception" } },
            },
        });

        await expect(adapterOver(server).ensureIndex(RECIPES_INDEX_DEFINITION)).resolves.toBeUndefined();
    });

    it("그 밖의 실패는 부른 쪽으로 올린다", async () => {
        const server = new FakeSearchServer({
            [`PUT /${RECIPES_INDEX_DEFINITION.index}`]: {
                status: 400,
                body: { error: { type: "mapper_parsing_exception" } },
            },
        });

        await expect(adapterOver(server).ensureIndex(RECIPES_INDEX_DEFINITION)).rejects.toThrow(
            "mapper_parsing_exception",
        );
    });

    it("색인이 있는지 물을 수 없으면 없는 것으로 읽지 않고 올린다", async () => {
        // 조회만 닿지 못하게 해서 조회 실패를 없음으로 읽으면 색인을 세우고 넘어가는 것이 드러나게 한다.
        const askFails: typeof fetch = (_input, init) =>
            init?.method === "PUT"
                ? Promise.resolve(new Response("{}", { status: 200 }))
                : Promise.reject(new Error("connect ECONNREFUSED"));
        const adapter = new OpenSearchIndexAdminAdapter(new OpenSearchClient(BASE_URL, askFails));

        await expect(adapter.ensureIndex(RECIPES_INDEX_DEFINITION)).rejects.toThrow("ECONNREFUSED");
    });
});
