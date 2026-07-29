import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import type { RuleAnchor, RuleAnchorReaderPort } from "~agent-api/domain/job/port/rule.anchor.reader.port.js";

/** 근거가 사용자 발화인지를 가르는 이벤트 종류다. */
const USER_MESSAGE_KIND = "agent_tracer.user.message";

/** 이벤트 표는 추적 서비스가 소유하므로 스키마를 선언하지 않고 근거 판정에 필요한 세 칸만 읽는다. */
@Injectable()
export class RuleAnchorReaderAdapter implements RuleAnchorReaderPort {
    constructor(@Inject(AGENT_DATA_SOURCE) private readonly dataSource: DataSource) {}

    async findById(id: string): Promise<RuleAnchor | null> {
        const rows: unknown = await this.dataSource.query(
            `SELECT id, user_id, task_id, kind FROM events WHERE id = $1 LIMIT 1`,
            [id],
        );
        return toAnchor(rows);
    }
}

function toAnchor(rows: unknown): RuleAnchor | null {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0] as {
        readonly id?: unknown;
        readonly user_id?: unknown;
        readonly task_id?: unknown;
        readonly kind?: unknown;
    };
    if (typeof row.id !== "string" || typeof row.user_id !== "string" || typeof row.task_id !== "string") {
        return null;
    }
    return {
        id: row.id,
        userId: row.user_id,
        taskId: row.task_id,
        userMessage: row.kind === USER_MESSAGE_KIND,
    };
}
