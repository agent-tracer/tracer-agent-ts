import { DEFAULT_USER_ID } from "@tracer-agent/platform";

export function resolveUserId(header: string | undefined): string {
    const trimmed = header?.trim();
    return trimmed !== undefined && trimmed.length > 0 ? trimmed : DEFAULT_USER_ID;
}
