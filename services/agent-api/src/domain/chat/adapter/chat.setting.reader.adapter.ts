import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { decryptSecret, isEncryptedSecret } from "@tracer-agent/platform";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import type { ChatSettingReaderPort } from "~agent-api/domain/chat/port/setting.reader.port.js";

/** 설정 표는 추적 서비스가 소유하므로 스키마를 선언하지 않고 값 한 칸만 읽는다. */
@Injectable()
export class ChatSettingReaderAdapter implements ChatSettingReaderPort {
    constructor(@Inject(AGENT_DATA_SOURCE) private readonly dataSource: DataSource) {}

    async findByScopeAndKey(scope: string, key: string): Promise<string | null> {
        const rows: unknown = await this.dataSource.query(
            `SELECT value FROM app_settings WHERE scope = $1 AND key = $2 LIMIT 1`,
            [scope, key],
        );
        const stored = storedValue(rows);
        if (stored === null) return null;
        return isEncryptedSecret(stored) ? decryptSecret(stored) : stored;
    }
}

function storedValue(rows: unknown): string | null {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const value = (rows[0] as { readonly value?: unknown }).value;
    return typeof value === "string" ? value : null;
}
