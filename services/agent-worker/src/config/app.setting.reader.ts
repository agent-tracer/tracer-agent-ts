import { decryptSecret, isEncryptedSecret } from "@tracer-agent/platform";
import type { DataSource } from "typeorm";

/** 설정 표는 추적 서비스가 소유하므로 스키마를 선언하지 않고 값 한 칸만 읽는다. */
export async function readAppSetting(
    dataSource: DataSource,
    scope: string,
    key: string,
): Promise<string | null> {
    const rows: unknown = await dataSource.query(
        `SELECT value FROM app_settings WHERE scope = $1 AND key = $2 LIMIT 1`,
        [scope, key],
    );
    const stored = storedValue(rows);
    if (stored === null) return null;
    return isEncryptedSecret(stored) ? decryptSecret(stored) : stored;
}

function storedValue(rows: unknown): string | null {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const value = (rows[0] as { readonly value?: unknown }).value;
    return typeof value === "string" ? value : null;
}
