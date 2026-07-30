import { describe, expect, it, vi } from "vitest";
import { JOB_KIND } from "~agent-api/domain/job/model/job.const.js";
import { SchemaValidationPipe } from "~agent-api/support/schema.validation.pipe.js";
import { JobInternalController } from "./job.internal.controller.js";
import { jobEnvelopeBodySchema, jobEnvelopeKindSchema } from "./job.internal.schema.js";

const METADATA = { type: "param" } as const;

describe("JobInternalController", () => {
    it("종류와 사용자를 그대로 발급에 넘긴다", async () => {
        const issueEnvelope = { execute: vi.fn().mockResolvedValue({ model: "claude-haiku-4-5" }) };
        const controller = new JobInternalController(issueEnvelope as never);

        const envelope = await controller.envelope(JOB_KIND.taskCleanup, { userId: "alice" });

        expect(issueEnvelope.execute).toHaveBeenCalledWith(JOB_KIND.taskCleanup, "alice");
        expect(envelope).toEqual({ model: "claude-haiku-4-5" });
    });

    it("워크플로가 태우지 않는 종류를 거절한다", () => {
        const pipe = new SchemaValidationPipe(jobEnvelopeKindSchema);

        expect(() => pipe.transform(JOB_KIND.ruleGeneration, METADATA)).toThrow();
        expect(pipe.transform(JOB_KIND.recipeScan, METADATA)).toBe(JOB_KIND.recipeScan);
    });

    it("사용자를 싣지 않은 본문을 거절한다", () => {
        const pipe = new SchemaValidationPipe(jobEnvelopeBodySchema);

        expect(() => pipe.transform({}, METADATA)).toThrow();
        expect(pipe.transform({ userId: "alice" }, METADATA)).toEqual({ userId: "alice" });
    });
});
