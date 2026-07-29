import { describe, expect, it } from "vitest";
import { listContractSchemaFiles } from "~agent-api/support/contract.js";
import { applyContractSchema } from "./schema.runner.js";

class RecordingExecutor {
    readonly statements: string[] = [];

    query(sql: string): Promise<unknown> {
        this.statements.push(sql);
        return Promise.resolve(undefined);
    }
}

describe("applyContractSchema", () => {
    it("계약이 선언한 스키마를 이름 순서대로 적용한다", async () => {
        const executor = new RecordingExecutor();

        const applied = await applyContractSchema(executor);

        expect(applied).toEqual([...listContractSchemaFiles()]);
        expect(executor.statements).toHaveLength(applied.length);
    });

    it("대화 원장의 표를 만드는 문장을 싣는다", async () => {
        const executor = new RecordingExecutor();

        await applyContractSchema(executor);

        expect(executor.statements[0]).toContain("chat_threads");
    });

    it("실행이 실패하면 남은 파일을 적용하지 않는다", async () => {
        const executor = {
            calls: 0,
            query(): Promise<unknown> {
                this.calls += 1;
                return Promise.reject(new Error("relation already exists"));
            },
        };

        await expect(applyContractSchema(executor)).rejects.toThrow("relation already exists");
        expect(executor.calls).toBe(1);
    });
});
