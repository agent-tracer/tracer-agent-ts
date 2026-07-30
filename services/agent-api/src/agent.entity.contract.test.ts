import { getMetadataArgsStorage } from "typeorm";
import { describe, expect, it } from "vitest";
import { AGENT_ENTITIES } from "~agent-api/agent.datasource.js";
import { readContractTables } from "~agent-api/support/contract.js";

const tables = readContractTables();
const storage = getMetadataArgsStorage();

interface EntitySurface {
    readonly entity: string;
    readonly table: string;
    readonly columns: readonly string[];
}

/** 엔티티가 실제로 읽고 쓰는 칸 이름이며 이름을 적지 않은 속성은 속성 이름이 그대로 칸이 된다. */
function surfaceOf(target: (typeof AGENT_ENTITIES)[number]): EntitySurface {
    const table = storage.tables.find((declared) => declared.target === target)?.name ?? "";
    const columns = storage.filterColumns(target).map((column) => column.options.name ?? column.propertyName);
    return { entity: target.name, table, columns };
}

const surfaces = AGENT_ENTITIES.map(surfaceOf);

describe("엔티티가 계약이 만드는 표를 그대로 읽는다", () => {
    it.each(surfaces)("$entity 가 $table 을 가리킨다", ({ table }) => {
        expect([...tables.keys()]).toContain(table);
    });

    it.each(surfaces)("$entity 의 칸이 계약의 $table 에 다 있다", ({ table, columns }) => {
        const declared = tables.get(table) ?? new Set<string>();

        expect(columns.filter((column) => !declared.has(column))).toEqual([]);
    });
});
