import { generateUlid } from "@tracer-agent/platform";
import type { PromptIdGeneratorPort } from "../port/prompt.runtime.port.js";

export class PromptUlidGenerator implements PromptIdGeneratorPort {
    next(): string {
        return generateUlid();
    }
}
