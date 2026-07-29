import { decryptSecret, encryptSecret, isEncryptedSecret } from "@tracer-agent/platform";
import type { Repository } from "typeorm";
import { isSensitiveSettingKey } from "~agent-api/domain/settings/model/setting.mask.policy.js";
import { isSettingKey, type SettingKey, type StoredSetting } from "~agent-api/domain/settings/model/setting.model.js";
import type { SettingRepositoryPort, SettingWrite } from "~agent-api/domain/settings/port/setting.repository.port.js";
import type { AppSettingEntity } from "./app.setting.entity.js";

export class TypeOrmSettingRepository implements SettingRepositoryPort {
    constructor(private readonly repo: Repository<AppSettingEntity>) {}

    async findByScopeAndKey(scope: string, key: string): Promise<string | null> {
        const row = await this.repo.findOne({ where: { scope, key } });
        return row === null ? null : plaintextOf(row.value);
    }

    async listByScope(scope: string): Promise<readonly StoredSetting[]> {
        const rows = await this.repo.find({ where: { scope }, order: { key: "ASC" } });
        const found: StoredSetting[] = [];
        for (const row of rows) {
            if (!isSettingKey(row.key)) continue;
            found.push({ key: row.key, value: plaintextOf(row.value), updatedAt: row.updatedAt });
        }
        return found;
    }

    async save(write: SettingWrite): Promise<void> {
        await this.repo.upsert(
            {
                scope: write.scope,
                key: write.key,
                value: storedValueOf(write.key, write.value),
                updatedAt: write.updatedAt,
            },
            ["scope", "key"],
        );
    }

    async remove(scope: string, key: SettingKey): Promise<boolean> {
        const result = await this.repo.delete({ scope, key });
        return (result.affected ?? 0) > 0;
    }
}

function plaintextOf(stored: string): string {
    return isEncryptedSecret(stored) ? decryptSecret(stored) : stored;
}

function storedValueOf(key: SettingKey, value: string): string {
    return isSensitiveSettingKey(key) ? encryptSecret(value) : value;
}
