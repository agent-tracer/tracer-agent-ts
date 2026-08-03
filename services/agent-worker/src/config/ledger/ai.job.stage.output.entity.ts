import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/** 잡 하나가 단계마다 낸 산출이며 다시 시도한 실행이 앞선 단계를 다시 실행하지 않게 한다. */
@Entity({ name: "ai_job_stage_outputs" })
@Index("ai_job_stage_outputs_job", ["jobId"])
export class AiJobStageOutputEntity {
    @PrimaryColumn({ name: "job_id", type: "text" })
    jobId!: string;

    @PrimaryColumn({ type: "text" })
    stage!: string;

    /** 같은 단계가 팬아웃과 재파견으로 여러 번 진행 중인 자리를 구분한다. */
    @PrimaryColumn({ type: "text" })
    slot!: string;

    @Column({ type: "jsonb" })
    payload!: unknown;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;
}
