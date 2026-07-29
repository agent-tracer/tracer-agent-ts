import { Column, Entity, PrimaryColumn } from "typeorm";

/** 범위와 키 한 쌍이 값 하나를 가리키는 설정 표의 PostgreSQL 저장 스키마다. */
@Entity({ name: "app_settings" })
export class AppSettingEntity {
    @PrimaryColumn({ type: "text" })
    scope!: string;

    @PrimaryColumn({ type: "text" })
    key!: string;

    @Column({ type: "text" })
    value!: string;

    @Column({ name: "updated_at", type: "timestamptz" })
    updatedAt!: Date;
}
