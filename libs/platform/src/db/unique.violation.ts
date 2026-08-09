// 원장 오류 번역이 유일 제약 위반을 가려낼 때 비교하는 Postgres 오류 코드다.
const UNIQUE_VIOLATION = "23505";

/** 원장이 유일 제약으로 같은 행의 두 번째 적기를 거절했다는 사실이며, 드라이버 오류의 모양이 원장 밖으로 새지 않게 막는 자리다. */
export class LedgerUniqueViolationError extends Error {
    constructor(cause?: unknown) {
        super("ledger rejected a duplicate row");
        this.name = "LedgerUniqueViolationError";
        if (cause !== undefined) this.cause = cause;
    }
}

function errorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null) return undefined;
    const code = (error as { readonly code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
}

/** TypeORM 은 드라이버 오류를 한 겹 감싸 올리므로 겉과 안을 모두 본다. */
function isUniqueViolation(error: unknown): boolean {
    if (errorCode(error) === UNIQUE_VIOLATION) return true;
    return errorCode((error as { readonly driverError?: unknown } | null)?.driverError) === UNIQUE_VIOLATION;
}

/** 원장에 적는 일을 감싸 유일 제약 위반만 부르는 쪽이 아는 오류로 번역하고 나머지 실패는 그대로 올린다. */
export async function translatingUniqueViolation<T>(work: () => Promise<T>): Promise<T> {
    try {
        return await work();
    } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        throw new LedgerUniqueViolationError(error);
    }
}
