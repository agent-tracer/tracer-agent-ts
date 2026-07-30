import type { ServedRoute } from "~agent-api/domain/health/model/served.route.model.js";
import type { ServedSurfacePort } from "~agent-api/domain/health/port/served.surface.port.js";

/** 표면 포트의 대역이며 생성자로 넘긴 창구를 등록 순서 그대로 되돌린다. */
export class FixedServedSurface implements ServedSurfacePort {
    constructor(private readonly declared: readonly ServedRoute[]) {}

    routes(): readonly ServedRoute[] {
        return this.declared;
    }
}
