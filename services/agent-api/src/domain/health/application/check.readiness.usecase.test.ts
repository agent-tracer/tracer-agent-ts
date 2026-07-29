import { describe, expect, it } from "vitest";
import type { ReadinessProbe } from "~agent-api/domain/health/port/readiness.probe.port.js";
import { CheckReadinessUseCase } from "./check.readiness.usecase.js";

function makeUseCase(ping: () => Promise<void>): CheckReadinessUseCase {
    const probe: ReadinessProbe = { ping };
    return new CheckReadinessUseCase(probe);
}

describe("CheckReadinessUseCase", () => {
    it("원장에 닿으면 준비된 것으로 본다", async () => {
        const useCase = makeUseCase(async () => undefined);

        await expect(useCase.execute()).resolves.toBe(true);
    });

    it("의존성 점검이 실패하면 준비되지 않은 것으로 본다", async () => {
        const useCase = makeUseCase(async () => {
            throw new Error("connection refused");
        });

        await expect(useCase.execute()).resolves.toBe(false);
    });
});
