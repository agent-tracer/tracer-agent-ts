import type { JobIdGeneratorPort } from "~agent-api/domain/job/port/job.id.generator.port.js";

export class SequentialJobIdGenerator implements JobIdGeneratorPort {
    private position = 0;

    constructor(private readonly prefix = "job-id") {}

    next(): string {
        this.position += 1;
        return `${this.prefix}-${this.position}`;
    }
}
