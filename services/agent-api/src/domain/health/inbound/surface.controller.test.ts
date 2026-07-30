import { describe, expect, it } from "vitest";
import { ListServedSurfaceUseCase } from "~agent-api/domain/health/application/list.served.surface.usecase.js";
import { FixedServedSurface } from "~agent-api/domain/health/port/__fakes__/fixed.served.surface.js";
import { SurfaceController } from "./surface.controller.js";

describe("SurfaceController", () => {
    it("이 프로세스가 여는 창구를 그대로 낸다", () => {
        const routes = [{ method: "GET", path: "/health" }];
        const controller = new SurfaceController(
            new ListServedSurfaceUseCase(new FixedServedSurface(routes)),
        );

        expect(controller.surface()).toEqual({ routes });
    });
});
