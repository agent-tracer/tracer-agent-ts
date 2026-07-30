import { Controller, Get } from "@nestjs/common";
import { ListServedSurfaceUseCase } from "~agent-api/domain/health/application/list.served.surface.usecase.js";
import { SkipGate } from "~agent-api/support/skip-gate.decorator.js";

/** 배포 단위 사이에서만 오가는 창구라 게이트웨이가 바깥에 열지 않는다. */
@Controller("internal/surface")
@SkipGate()
export class SurfaceController {
    constructor(private readonly listSurface: ListServedSurfaceUseCase) {}

    @Get()
    surface() {
        return this.listSurface.execute();
    }
}
