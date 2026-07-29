import { generateUlid } from "@tracer-agent/platform";
import type { CleanupIdGeneratorPort } from "~agent-worker/domain/cleanup/port/cleanup.id.generator.port.js";

/** 제안 저장 행과 잡 궤적에 쓸 ULID를 만든다. */
export class CleanupUlidGenerator implements CleanupIdGeneratorPort {
    next(): string {
        return generateUlid();
    }
}
