const SAFE_ENV_KEYS = [
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "SHELL",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TZ",
    "TMPDIR",
    "TMP",
    "TEMP",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "no_proxy",
    // 로컬 프로파일에서 API 키 없이 실행할 때 하위 claude CLI가 이 구독 토큰으로 인증한다.
    "CLAUDE_CODE_OAUTH_TOKEN",
] as const;

/** 허용 목록과 명시 오버라이드만으로 하위 프로세스 환경을 만들어 자격 증명이 도구로 새지 않게 한다. */
export function buildAgentEnv(
    overrides: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
    const base: Record<string, string | undefined> = {};
    for (const key of SAFE_ENV_KEYS) {
        const value = process.env[key];
        if (value !== undefined) base[key] = value;
    }
    return { ...base, ...overrides };
}
