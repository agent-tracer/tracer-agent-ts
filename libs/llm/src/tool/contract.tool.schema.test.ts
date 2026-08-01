import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
    contractEnumValues,
    contractIntDefault,
    contractIntMax,
    contractLimit,
    contractToolDefinitions,
    contractToolShape,
    type ContractToolFile,
} from "./contract.tool.schema.js";

const FILE: ContractToolFile = {
    agent: "sample",
    version: "v0.0.1",
    limits: { maxItems: 7 },
    failures: { toolFailed: "Tool {tool} failed: {reason}." },
    tools: {
        read_thing: {
            description: "설명",
            args: {
                taskId: { type: "string", required: true, trim: true, minLength: 1, description: "id" },
                order: {
                    type: "enum",
                    required: false,
                    values: ["asc", "desc"],
                    default: "asc",
                    description: "방향",
                },
                limit: { type: "integer", required: false, min: 1, max: 300, default: 100, description: "쪽" },
                ids: {
                    type: "array",
                    required: false,
                    maxItems: 2,
                    items: { type: "string", trim: true, minLength: 1 },
                    description: "목록",
                },
                input: { type: "object", required: true, description: "본문" },
            },
        },
    },
};

const shape = contractToolShape(FILE.tools["read_thing"]!);
const schema = z.object(shape);

describe("contractToolShape", () => {
    it("계약의 선언 순서를 인자 순서로 낸다", () => {
        expect(Object.keys(shape)).toEqual(["taskId", "order", "limit", "ids", "input"]);
    });

    it("필수 문자열의 공백을 걷고 빈 값을 거절한다", () => {
        expect(schema.parse({ taskId: "  t1 ", input: {} }).taskId).toBe("t1");
        expect(() => schema.parse({ taskId: "   ", input: {} })).toThrow();
    });

    it("열거의 허용값 밖을 거절한다", () => {
        expect(() => schema.parse({ taskId: "t1", input: {}, order: "sideways" })).toThrow();
    });

    it("정수의 상한을 넘는 값을 거절한다", () => {
        expect(() => schema.parse({ taskId: "t1", input: {}, limit: 301 })).toThrow();
    });

    it("배열 인자를 배열로 받고 개수 상한을 지킨다", () => {
        expect(schema.parse({ taskId: "t1", input: {}, ids: ["a", "b"] }).ids).toEqual(["a", "b"]);
        expect(() => schema.parse({ taskId: "t1", input: {}, ids: ["a", "b", "c"] })).toThrow();
    });

    it("객체 인자를 문자열로 받지 않는다", () => {
        expect(() => schema.parse({ taskId: "t1", input: '{"a":1}' })).toThrow();
        expect(schema.parse({ taskId: "t1", input: { a: 1 } }).input).toEqual({ a: 1 });
    });
});

describe("contractToolDefinitions", () => {
    it("이름과 설명을 계약에서 그대로 낸다", () => {
        expect(contractToolDefinitions(FILE).map((tool) => [tool.name, tool.description])).toEqual([
            ["read_thing", "설명"],
        ]);
    });
});

describe("계약 값 조회", () => {
    it("기본값과 상한과 열거값과 상한 절을 낸다", () => {
        expect(contractIntDefault(FILE, "read_thing", "limit")).toBe(100);
        expect(contractIntMax(FILE, "read_thing", "limit")).toBe(300);
        expect(contractEnumValues(FILE, "read_thing", "order")).toEqual(["asc", "desc"]);
        expect(contractLimit(FILE, "maxItems")).toBe(7);
    });

    it("계약에 없는 이름을 거절한다", () => {
        expect(() => contractIntDefault(FILE, "read_thing", "cursor")).toThrow();
        expect(() => contractLimit(FILE, "maxRounds")).toThrow();
    });
});
