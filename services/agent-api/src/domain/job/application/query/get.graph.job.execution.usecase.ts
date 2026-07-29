import { Inject, Injectable } from "@nestjs/common";
import { mapGraphJobExecution, type GraphJobExecutionDto } from "~agent-api/domain/job/model/graph.job.execution.view.model.js";
import {
    GRAPH_JOB_EXECUTION_READER,
    type GraphJobExecutionReaderPort,
} from "~agent-api/domain/job/port/graph.job.execution.reader.port.js";

/** 자기 접수구에서 원장을 직접 쓰는 구현체의 실행 상태를 소유자에게만 조회해 준다. */
@Injectable()
export class GetGraphJobExecutionUseCase {
    constructor(
        @Inject(GRAPH_JOB_EXECUTION_READER)
        private readonly executions: GraphJobExecutionReaderPort,
    ) {}

    async execute(userId: string, id: string): Promise<GraphJobExecutionDto | null> {
        const row = await this.executions.findById(id);
        // 남의 실행은 존재 여부도 드러내지 않는다.
        if (row === null || !row.isOwnedBy(userId)) return null;
        return mapGraphJobExecution(row);
    }
}
