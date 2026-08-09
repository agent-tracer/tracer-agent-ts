import { Check, Column, Entity, Index, PrimaryColumn } from "typeorm";

/** 이 원장이 소유한 색인 대상은 레시피 하나이며 계약의 CHECK 가 같은 값을 받는다. */
export const SEARCH_OUTBOX_TARGET_RECIPE = "recipe";

/** 레시피 쓰기와 같은 커밋에 색인 반영 요청을 남기는 표다. */
@Entity({ name: "search_outbox" })
@Index("search_outbox_created", ["createdAt"])
@Check("search_outbox_target_check", `"target" = '${SEARCH_OUTBOX_TARGET_RECIPE}'`)
export class SearchOutboxRowEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

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
