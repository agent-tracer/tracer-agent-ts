import type { SettingKey, StoredSetting } from "~agent-api/domain/settings/model/setting.model.js";

export const SETTING_REPOSITORY = Symbol("SettingRepository");

/** 한 번에 쓰는 설정 하나이며 scope는 값을 소유한 사용자다. */
export interface SettingWrite {
    readonly scope: string;
    readonly key: SettingKey;
    readonly value: string;
    readonly updatedAt: Date;
}

/** 값은 이 포트 밖에서 평문으로만 오가고 저장 매체 안의 보관 형태는 구현이 정한다. */
export interface SettingRepositoryPort {
    findByScopeAndKey(scope: string, key: string): Promise<string | null>;
    listByScope(scope: string): Promise<readonly StoredSetting[]>;
    save(write: SettingWrite): Promise<void>;
    remove(scope: string, key: SettingKey): Promise<boolean>;
}
