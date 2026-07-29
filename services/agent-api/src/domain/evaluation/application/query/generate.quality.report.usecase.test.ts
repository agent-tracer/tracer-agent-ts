import { describe, expect, it } from "vitest";
import { evaluationHarness, seedDataset } from "../evaluation.test.fixture.js";
import { GenerateQualityReportUseCase } from "./generate.quality.report.usecase.js";

describe("GenerateQualityReportUseCase", () => {
    it("사례 수와 공개 등급 분포를 센다", async () => {
        const { repository } = evaluationHarness();
        await seedDataset(repository);
        const report = await new GenerateQualityReportUseCase(repository).execute("user-1", "dataset-1");
        expect(report.totalExamples).toBe(1);
        expect(report.disclosureDistribution.synthetic).toBe(1);
    });
});
