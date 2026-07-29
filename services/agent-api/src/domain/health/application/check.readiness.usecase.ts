import { Inject, Injectable } from "@nestjs/common";
import { READINESS_PROBE, type ReadinessProbe } from "~agent-api/domain/health/port/readiness.probe.port.js";

@Injectable()
export class CheckReadinessUseCase {
    constructor(@Inject(READINESS_PROBE) private readonly probe: ReadinessProbe) {}

    async execute(): Promise<boolean> {
        try {
            await this.probe.ping();
            return true;
        } catch {
            return false;
        }
    }
}
