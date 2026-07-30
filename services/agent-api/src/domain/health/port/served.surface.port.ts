import type { ServedRoute } from "~agent-api/domain/health/model/served.route.model.js";

export const SERVED_SURFACE = Symbol("SERVED_SURFACE");

/** 이 프로세스에 등록된 창구를 메서드와 경로 템플릿의 쌍으로 낸다. */
export interface ServedSurfacePort {
    routes(): readonly ServedRoute[];
}
