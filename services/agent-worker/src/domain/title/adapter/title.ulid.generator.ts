import { generateUlid, type IClock } from "@tracer-agent/platform";
import type { TitleIdGeneratorPort } from "~agent-worker/domain/title/port/title.id.generator.port.js";

/** 궤적 한 줄마다 시간 순서가 보존되는 식별자를 붙인다. */
export class TitleUlidGenerator implements TitleIdGeneratorPort {
    constructor(private readonly clock: IClock) {}

    next(): string {
        return generateUlid(this.clock.nowMs());
    }
}
