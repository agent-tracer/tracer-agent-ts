import { Inject, Injectable } from "@nestjs/common";
import { generateUlid } from "@tracer-agent/platform";
import { JOB_CLOCK, type ClockPort } from "~agent-api/domain/job/port/clock.port.js";
import type { JobIdGeneratorPort } from "~agent-api/domain/job/port/job.id.generator.port.js";

@Injectable()
export class JobUlidGenerator implements JobIdGeneratorPort {
    constructor(@Inject(JOB_CLOCK) private readonly clock: ClockPort) {}

    next(): string {
        return generateUlid(this.clock.now().getTime());
    }
}
