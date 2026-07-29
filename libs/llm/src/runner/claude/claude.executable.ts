import { createRequire } from "node:module";

// glibc 런타임에만 채워지는 필드이므로 없으면 musl로 본다.
function isMuslLinux(): boolean {
    const report = process.report.getReport() as { header?: { glibcVersionRuntime?: string } };
    return report.header?.glibcVersionRuntime === undefined;
}

/** 플랫폼과 아키텍처와 libc에 대응하는 네이티브 CLI 패키지 이름이다. */
export function claudePlatformPackage(
    platform: NodeJS.Platform,
    arch: string,
    muslLinux: boolean,
): string | undefined {
    if (platform !== "linux" && platform !== "darwin" && platform !== "win32") return undefined;
    const suffix = platform === "linux" && muslLinux ? "-musl" : "";
    return `@anthropic-ai/claude-agent-sdk-${platform}-${arch}${suffix}`;
}

/** SDK의 자동탐색이 libc를 보지 않아 엉뚱한 바이너리를 집으므로 플랫폼과 libc에 맞는 CLI 경로를 직접 해석한다. */
export function resolveClaudeExecutablePath(): string | undefined {
    const pkg = claudePlatformPackage(process.platform, process.arch, isMuslLinux());
    if (pkg === undefined) return undefined;
    const binary = process.platform === "win32" ? "claude.exe" : "claude";
    try {
        return createRequire(import.meta.url).resolve(`${pkg}/${binary}`);
    } catch {
        return undefined;
    }
}
