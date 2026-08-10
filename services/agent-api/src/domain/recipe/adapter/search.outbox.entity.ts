import type { AgentAxis } from "@tracer-agent/llm";
import { Check, Column, Entity, Index, PrimaryColumn } from "typeorm";
import { SEARCH_OUTBOX_TARGET_RECIPE } from "~agent-api/domain/recipe/model/recipe.const.js";
import { SearchOutboxRow } from "~agent-api/domain/recipe/model/search.outbox.model.js";

/** 색인 반영 요청의 PostgreSQL 저장 스키마이며 이 원장이 소유한 대상은 레시피 하나다. */
@Entity({ name: "search_outbox" })
@Index("search_outbox_axis_created", ["backend", "createdAt"])
@Check("search_outbox_target_check", `"target" = '${SEARCH_OUTBOX_TARGET_RECIPE}'`)
export class SearchOutboxEntity {
    /** 행의 식별자는 적재하는 축이 스스로 만들므로 기본 키는 id 하나이고 축은 배출이 거르는 칸이다. */
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ type: "text" })
    backend!: AgentAxis;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ type: "text" })
    target!: string;

    @Column({ name: "target_id", type: "text" })
    targetId!: string;

    @Column({ type: "integer", default: 0 })
    attempts!: number;

    @Column({ name: "last_error", type: "text", nullable: true })
    lastError!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
}

export function toSearchOutboxRow(row: SearchOutboxEntity): SearchOutboxRow {
    const outbox = new SearchOutboxRow();
    outbox.id = row.id;
    outbox.backend = row.backend;
    outbox.userId = row.userId;
    outbox.target = row.target;
    outbox.targetId = row.targetId;
    outbox.attempts = row.attempts;
    outbox.lastError = row.lastError;
    outbox.createdAt = row.createdAt;
    return outbox;
}

export function toSearchOutboxEntity(outbox: SearchOutboxRow): SearchOutboxEntity {
    const row = new SearchOutboxEntity();
    row.id = outbox.id;
    row.backend = outbox.backend;
    row.userId = outbox.userId;
    row.target = outbox.target;
    row.targetId = outbox.targetId;
    row.attempts = outbox.attempts;
    row.lastError = outbox.lastError;
    row.createdAt = outbox.createdAt;
    return row;
}
