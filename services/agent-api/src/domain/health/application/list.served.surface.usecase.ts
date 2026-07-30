import { Inject, Injectable } from "@nestjs/common";
import { sortServedRoutes, type ServedRoute } from "~agent-api/domain/health/model/served.route.model.js";
import { SERVED_SURFACE, type ServedSurfacePort } from "~agent-api/domain/health/port/served.surface.port.js";

/** 계약이 선언한 창구에 서버가 있는지 대조할 수 있도록 이 프로세스의 표면을 그대로 낸다. */
@Injectable()
export class ListServedSurfaceUseCase {
    constructor(@Inject(SERVED_SURFACE) private readonly surface: ServedSurfacePort) {}

    execute(): { readonly routes: readonly ServedRoute[] } {
        return { routes: sortServedRoutes(this.surface.routes()) };
    }
}
