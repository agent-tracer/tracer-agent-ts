import { Client, Connection, WorkflowNotFoundError } from "@temporalio/client";
import { loadApplicationConfig } from "@tracer-agent/platform";

export interface TemporalHandle {
    readonly connection: Connection;
    readonly client: Client;
}

/** 부르는 쪽이 종료 시 연결을 직접 닫아야 하는 Temporal 연결을 만든다. */
export async function createTemporalConnection(): Promise<TemporalHandle> {
    const { temporal } = loadApplicationConfig();
    const connection = await Connection.connect({ address: temporal.address });
    const client = new Client({ connection, namespace: temporal.namespace });
    return { connection, client };
}

/** 취소할 워크플로가 이미 없다는 뜻이며, 연결 실패와 구분해야 한다. */
export function isWorkflowNotFound(error: unknown): boolean {
    return error instanceof WorkflowNotFoundError;
}
