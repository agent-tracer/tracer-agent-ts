import type { LedgerRecord } from "~agent-api/domain/recipe/model/ledger.record.js";

/** 추적 원장의 사건 하나를 받아 자기 원장에 투영하는 자리다. */
export interface LedgerEventHandlerPort {
    handle(record: LedgerRecord): Promise<void>;
}
