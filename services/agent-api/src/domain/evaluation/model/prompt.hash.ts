import { createHash } from "node:crypto";

export function promptContentHash(content: string): string {
    return createHash("sha256").update(content.replace(/\r\n/g, "\n").trim()).digest("hex");
}

export function resolvePromptContentHash(content: string, claimed?: string): string {
    const computed = promptContentHash(content);
    if (claimed !== undefined && claimed !== computed) throw new Error("Prompt content hash mismatch");
    return computed;
}
