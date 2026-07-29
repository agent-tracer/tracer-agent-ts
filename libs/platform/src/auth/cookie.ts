/** 세션 쿠키 하나만 다루는 최소 파서다. */
export function parseCookie(header: string | undefined, name: string): string | null {
    if (header === undefined) return null;
    for (const part of header.split(";")) {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex === -1) continue;
        const key = part.slice(0, separatorIndex).trim();
        if (key !== name) continue;
        const value = part.slice(separatorIndex + 1).trim();
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }
    return null;
}
