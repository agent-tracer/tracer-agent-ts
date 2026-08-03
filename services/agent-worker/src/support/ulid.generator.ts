import { generateUlid, type IClock } from "@tracer-agent/platform";
import type { IdGeneratorPort } from "~agent-worker/support/id.generator.port.js";

/** 시간 순서가 보존되는 식별자를 붙이며 시계를 받으면 그 시계의 지금을 쓴다. */
export class UlidGenerator implements IdGeneratorPort {
    constructor(private readonly clock?: IClock) {}

    next(): string {
        return this.clock === undefined ? generateUlid() : generateUlid(this.clock.nowMs());
    }
}
