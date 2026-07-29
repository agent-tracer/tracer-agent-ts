import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTED_PREFIX = "enc:v1:";
const IV_BYTES = 12;
// 소스 실행과 컨테이너 실행이 같은 로컬 DB를 공유하므로 두 경로의 기본 키가 같아야 한다.
const INSECURE_LOCAL_DEV_KEY = "monitor-dev-key";

function resolveKey(): Buffer {
    const secret = process.env["MONITOR_SETTINGS_ENCRYPTION_KEY"];
    if (!secret) {
        if (process.env["MONITOR_PROFILE"] === "prd") {
            throw new Error("MONITOR_SETTINGS_ENCRYPTION_KEY must be set in the prd profile.");
        }
        return createHash("sha256").update(INSECURE_LOCAL_DEV_KEY, "utf8").digest();
    }
    return createHash("sha256").update(secret, "utf8").digest();
}

/** 저장할 때 쓴 키와 지금 키가 달라 복호화가 성립하지 않는다. */
export class SecretKeyMismatchError extends Error {
    constructor() {
        super(
            "저장된 설정을 지금 키로 풀 수 없다. MONITOR_SETTINGS_ENCRYPTION_KEY가 저장 당시와 다르다. "
            + "키를 되돌리거나 그 설정을 지우고 다시 넣어야 한다.",
        );
        this.name = "SecretKeyMismatchError";
    }
}

export function isEncryptedSecret(value: string): boolean {
    return value.startsWith(ENCRYPTED_PREFIX);
}

/** 평문을 지금 키로 암호화해 초기벡터와 인증태그와 암호문을 한 문자열에 담는다. */
export function encryptSecret(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, resolveKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const parts = [iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")];
    return `${ENCRYPTED_PREFIX}${parts.join(":")}`;
}

export function decryptSecret(stored: string): string {
    if (!isEncryptedSecret(stored)) {
        throw new Error("Value is not in the expected encrypted format.");
    }
    const parts = stored.slice(ENCRYPTED_PREFIX.length).split(":");
    const [ivB64, authTagB64, ciphertextB64] = parts;
    if (parts.length !== 3 || !ivB64 || !authTagB64 || !ciphertextB64) {
        throw new Error("Malformed encrypted value.");
    }
    const decipher = createDecipheriv(ALGORITHM, resolveKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
    try {
        return Buffer.concat([
            decipher.update(Buffer.from(ciphertextB64, "base64")),
            decipher.final(),
        ]).toString("utf8");
    } catch {
        throw new SecretKeyMismatchError();
    }
}
