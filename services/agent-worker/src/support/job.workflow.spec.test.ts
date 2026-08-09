import { describe, expect, it } from "vitest";
import { generateLimitsOf, JOB_GENERATE_LIMITS, type JobGenerateLimits } from "./job.workflow.spec.js";

const OWN: JobGenerateLimits = {
    startToClose: "5 minutes",
    scheduleToClose: "20 minutes",
    heartbeat: "30 seconds",
    maximumAttempts: 3,
    initialInterval: "10 seconds",
};

describe("계약이 적은 상한과 이 축이 정한 상한", () => {
    it("계약이 그 종류를 적으면 계약의 값을 쓴다", () => {
        const limits = generateLimitsOf(
            { name: "x", startToCloseSeconds: 420, scheduleToCloseSeconds: 900, heartbeatTimeoutSeconds: 15, maximumAttempts: 7 },
            OWN,
        );

        expect(limits).toMatchObject({
            startToClose: "420 seconds",
            scheduleToClose: "900 seconds",
            heartbeat: "15 seconds",
            maximumAttempts: 7,
        });
    });

    it("계약이 상한을 비워 두면 이 축이 정한 값을 쓴다", () => {
        expect(generateLimitsOf({ name: "x" }, OWN)).toEqual(OWN);
        expect(generateLimitsOf(undefined, OWN)).toEqual(OWN);
    });

    it("계약이 일부만 적으면 적은 자리만 계약을 따른다", () => {
        const limits = generateLimitsOf({ name: "x", startToCloseSeconds: 60 }, OWN);

        expect(limits.startToClose).toBe("60 seconds");
        expect(limits.scheduleToClose).toBe(OWN.scheduleToClose);
    });

    it("계약이 상한을 적은 종류는 그 값이 실행에 실린다", () => {
        expect(JOB_GENERATE_LIMITS.titleSuggestion.startToClose).toBe("300 seconds");
    });
});
