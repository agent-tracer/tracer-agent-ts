import { Injectable, RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants.js";
import { DiscoveryService, MetadataScanner } from "@nestjs/core";
import { joinRoutePath, type ServedRoute } from "~agent-api/domain/health/model/served.route.model.js";
import type { ServedSurfacePort } from "~agent-api/domain/health/port/served.surface.port.js";

/** 손으로 적은 목록이 라우팅과 달라지지 않도록 등록된 컨트롤러의 라우팅 표를 그대로 읽는다. */
@Injectable()
export class NestServedSurfaceAdapter implements ServedSurfacePort {
    constructor(
        private readonly discovery: DiscoveryService,
        private readonly scanner: MetadataScanner,
    ) {}

    routes(): readonly ServedRoute[] {
        return this.discovery
            .getControllers()
            .flatMap((wrapper) => controllerRoutes(wrapper.metatype, this.scanner));
    }
}

function controllerRoutes(metatype: unknown, scanner: MetadataScanner): ServedRoute[] {
    if (typeof metatype !== "function") return [];
    const prototype = (metatype as { readonly prototype?: object }).prototype;
    if (prototype === undefined) return [];
    return scanner
        .getAllMethodNames(prototype)
        .flatMap((name) => handlerRoutes(metatype, prototype, name));
}

function handlerRoutes(metatype: object, prototype: object, name: string): ServedRoute[] {
    const handler = (prototype as Record<string, unknown>)[name];
    if (typeof handler !== "function") return [];
    const verb = readVerb(handler);
    if (verb === null) return [];
    return declaredPaths(metatype).flatMap((base) =>
        declaredPaths(handler).map((path) => ({ method: verb, path: joinRoutePath(base, path) })),
    );
}

function readVerb(handler: object): string | null {
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as unknown;
    if (typeof method !== "number") return null;
    const verb = RequestMethod[method];
    return verb === undefined || verb === "ALL" ? null : verb;
}

function declaredPaths(target: object): string[] {
    const declared = Reflect.getMetadata(PATH_METADATA, target) as unknown;
    if (Array.isArray(declared)) return declared.map(String);
    return [typeof declared === "string" ? declared : ""];
}
