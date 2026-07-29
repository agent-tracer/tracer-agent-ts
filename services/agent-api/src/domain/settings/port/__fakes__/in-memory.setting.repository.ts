import type { SettingKey, StoredSetting } from "~agent-api/domain/settings/model/setting.model.js";
import type { SettingRepositoryPort, SettingWrite } from "~agent-api/domain/settings/port/setting.repository.port.js";

/** 설정 저장소 포트의 대역이며 범위와 키 한 쌍을 값 하나에 대응시킨다. */
export class InMemorySettingRepository implements SettingRepositoryPort {
    private readonly rows = new Map<string, SettingWrite>();

    seed(...writes: SettingWrite[]): void {
        for (const write of writes) this.rows.set(idOf(write.scope, write.key), write);
    }

    findByScopeAndKey(scope: string, key: string): Promise<string | null> {
        return Promise.resolve(this.rows.get(idOf(scope, key))?.value ?? null);
    }

    listByScope(scope: string): Promise<readonly StoredSetting[]> {
        const found = [...this.rows.values()]
            .filter((row) => row.scope === scope)
            .sort((left, right) => left.key.localeCompare(right.key))
            .map(({ key, value, updatedAt }) => ({ key, value, updatedAt }));
        return Promise.resolve(found);
    }

    save(write: SettingWrite): Promise<void> {
        this.rows.set(idOf(write.scope, write.key), write);
        return Promise.resolve();
    }

    remove(scope: string, key: SettingKey): Promise<boolean> {
        return Promise.resolve(this.rows.delete(idOf(scope, key)));
    }
}

function idOf(scope: string, key: string): string {
    return JSON.stringify([scope, key]);
}
