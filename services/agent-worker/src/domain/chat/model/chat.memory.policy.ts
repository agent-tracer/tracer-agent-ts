/** 저장된 문장은 다음 턴의 문맥으로 되돌아오므로 지시문과 자격 증명은 실리기 전에 막는다. */
const INSTRUCTION_PATTERNS: readonly RegExp[] = [
    /\bignore\s+(all\s+|any\s+)?(previous|prior|above)\b/i,
    /\bdisregard\s+(all\s+|any\s+)?(previous|prior|above)\b/i,
    /^\s*(system|assistant|developer)\s*:/im,
    /\byou\s+(must|should|will)\s+(always|never)\b/i,
    /\balways\s+call\b/i,
    /<\s*\/?\s*(system|memory|summary|history|tool_result)\b/i,
];

const SECRET_PATTERNS: readonly RegExp[] = [
    /\b(sk|pk|ghp|gho|xox[baprs])-[A-Za-z0-9_-]{8,}/,
    /\bBearer\s+[A-Za-z0-9._-]{8,}/i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\b[A-Z0-9_]*(?:API|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*\s*=\s*\S+/,
    /\bauthorization\s*:\s*\S+/i,
];

export const INSTRUCTION_REJECTION = "memory-content-looks-like-an-instruction";
export const SECRET_REJECTION = "memory-content-contains-a-secret";

/** 실을 수 없는 내용이면 그 사유를 내고 실을 수 있으면 null 을 낸다. */
export function memoryRejection(content: string): string | null {
    if (SECRET_PATTERNS.some((pattern) => pattern.test(content))) return SECRET_REJECTION;
    if (INSTRUCTION_PATTERNS.some((pattern) => pattern.test(content))) return INSTRUCTION_REJECTION;
    return null;
}
