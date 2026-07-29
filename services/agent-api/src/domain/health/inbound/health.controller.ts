import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { CheckReadinessUseCase } from "~agent-api/domain/health/application/check.readiness.usecase.js";
import { NoEnvelope } from "~agent-api/support/no-envelope.decorator.js";
import { SkipGate } from "~agent-api/support/skip-gate.decorator.js";

/** 신원 없이 열리는 프로브이며 응답 봉투도 씌우지 않는다. */
@Controller("health")
@SkipGate()
@NoEnvelope()
export class HealthController {
    constructor(private readonly readiness: CheckReadinessUseCase) {}

    @Get()
    health(): { readonly status: "ok" } {
        return { status: "ok" };
    }

    @Get("ready")
    async ready(): Promise<{ readonly status: "ok" }> {
        const ready = await this.readiness.execute();
        if (!ready) throw new ServiceUnavailableException({ status: "unready" });
        return { status: "ok" };
    }
}
