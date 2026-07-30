import "reflect-metadata";
import { Controller, Delete, Get, Module, Post } from "@nestjs/common";
import { DiscoveryModule, DiscoveryService, MetadataScanner, NestFactory } from "@nestjs/core";
import { describe, expect, it } from "vitest";
import { NestServedSurfaceAdapter } from "./nest.served.surface.adapter.js";

@Controller("api/agent/jobs")
class JobProbeController {
    @Get()
    list() {
        return { items: [] };
    }

    @Get(":id/steps")
    steps() {
        return { items: [] };
    }

    @Post(":id/cancel")
    cancel() {
        return { job: null };
    }
}

@Controller("api/agent/chat/threads")
class ChatProbeController {
    @Delete(":threadId")
    remove() {
        return { deleted: true };
    }
}

@Module({
    imports: [DiscoveryModule],
    controllers: [JobProbeController, ChatProbeController],
})
class ProbeModule {}

async function readRoutes() {
    const context = await NestFactory.createApplicationContext(ProbeModule, { logger: false });
    const adapter = new NestServedSurfaceAdapter(
        context.get(DiscoveryService),
        context.get(MetadataScanner),
    );
    const routes = adapter.routes();
    await context.close();
    return routes;
}

describe("NestServedSurfaceAdapter", () => {
    it("등록된 컨트롤러의 경로를 계약과 같은 자리표시자 문법으로 낸다", async () => {
        const routes = await readRoutes();

        expect(routes).toContainEqual({ method: "GET", path: "/api/agent/jobs" });
        expect(routes).toContainEqual({ method: "GET", path: "/api/agent/jobs/{id}/steps" });
        expect(routes).toContainEqual({ method: "POST", path: "/api/agent/jobs/{id}/cancel" });
        expect(routes).toContainEqual({ method: "DELETE", path: "/api/agent/chat/threads/{threadId}" });
    });

    it("라우팅에 등록되지 않은 메서드는 표면에 싣지 않는다", async () => {
        const routes = await readRoutes();

        expect(routes).toHaveLength(4);
    });
});
