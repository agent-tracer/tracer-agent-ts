import { describe, expect, it } from "vitest";
import { CancelExperimentUseCase } from "./cancel.experiment.usecase.js";
describe("CancelExperimentUseCase", () => { it("실험 취소 기능을 제공한다", () => { expect(CancelExperimentUseCase).toBeDefined(); }); });
