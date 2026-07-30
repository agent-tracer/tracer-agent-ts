import { describe, expect, it } from "vitest";
import { FixedServedSurface } from "~agent-api/domain/health/port/__fakes__/fixed.served.surface.js";
import { ListServedSurfaceUseCase } from "./list.served.surface.usecase.js";

describe("ListServedSurfaceUseCase", () => {
    it("등록된 창구를 메서드와 경로의 사전순으로 낸다", () => {
        const useCase = new ListServedSurfaceUseCase(
            new FixedServedSurface([
                { method: "POST", path: "/api/agent/jobs" },
                { method: "GET", path: "/api/agent/jobs/{id}" },
                { method: "GET", path: "/api/agent/jobs" },
            ]),
        );

        expect(useCase.execute()).toEqual({
            routes: [
                { method: "GET", path: "/api/agent/jobs" },
                { method: "GET", path: "/api/agent/jobs/{id}" },
                { method: "POST", path: "/api/agent/jobs" },
            ],
        });
    });

    it("여는 창구가 없으면 빈 표면을 낸다", () => {
        const useCase = new ListServedSurfaceUseCase(new FixedServedSurface([]));

        expect(useCase.execute()).toEqual({ routes: [] });
    });
});
