import { logInfo } from "@tracer-agent/platform";
import { listContractSchemaFiles, readContractSchemaFile } from "~agent-api/support/contract.js";

/** 스키마 SQL 한 덩어리를 원장에 적용하는 실행기이며 DataSource가 이 모양을 만족한다. */
export interface SchemaExecutor {
    query(sql: string): Promise<unknown>;
}

/** 존재하면 넘어가는 문장으로만 쓰인 계약의 스키마를 이름 순서대로 적용하고 적용한 파일 이름을 낸다. */
export async function applyContractSchema(executor: SchemaExecutor): Promise<readonly string[]> {
    const applied: string[] = [];
    for (const name of listContractSchemaFiles()) {
        await executor.query(readContractSchemaFile(name));
        applied.push(name);
    }
    logInfo({ msg: "schema.contract.applied", files: applied });
    return applied;
}
