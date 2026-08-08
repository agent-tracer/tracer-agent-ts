// pg 가 연결을 내주지 못했을 때 내는 문구이며 이 글자를 아는 자리는 이 파일 하나뿐이다.
const ACQUISITION_TIMEOUT = "timeout exceeded when trying to connect";
const POOL_CLOSED = "cannot use a pool after calling end on the pool";

/** 원장 연결을 빌리지 못해 창구가 요청을 수용하지 못했다는 사실이며, 드라이버 오류의 모양이 원장 밖으로 새지 않게 막는 자리다. */
export class LedgerUnavailableError extends Error {
    constructor(cause?: unknown) {
        super("ledger connection was not available");
        this.name = "LedgerUnavailableError";
        if (cause !== undefined) this.cause = cause;
    }
}

function errorMessageOf(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) return undefined;
    const message = (error as { readonly message?: unknown }).message;
    return typeof message === "string" ? message.toLowerCase() : undefined;
}

function saysAcquisitionFailed(error: unknown): boolean {
    const message = errorMessageOf(error);
    if (message === undefined) return false;
    return message.includes(ACQUISITION_TIMEOUT) || message.includes(POOL_CLOSED);
}

/** TypeORM 은 드라이버 오류를 한 겹 감싸 올리므로 겉과 안을 모두 본다. */
export function isLedgerAcquisitionFailure(error: unknown): boolean {
    if (error instanceof LedgerUnavailableError) return true;
    if (saysAcquisitionFailed(error)) return true;
    return saysAcquisitionFailed((error as { readonly driverError?: unknown } | null)?.driverError);
}

/** 원장에 닿는 일을 감싸 연결 획득 실패만 부르는 쪽이 아는 오류로 번역하고 나머지 실패는 그대로 올린다. */
export async function translatingLedgerUnavailable<T>(work: () => Promise<T>): Promise<T> {
    try {
        return await work();
    } catch (error) {
        if (error instanceof LedgerUnavailableError) throw error;
        if (!isLedgerAcquisitionFailure(error)) throw error;
        throw new LedgerUnavailableError(error);
    }
}
