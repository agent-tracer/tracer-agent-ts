/** 이 프로세스가 실제로 여는 창구 하나이며 경로는 계약과 같은 자리표시자 문법으로 적는다. */
export interface ServedRoute {
    readonly method: string;
    readonly path: string;
}

/** 컨트롤러와 핸들러가 나눠 가진 경로 조각을 계약이 읽는 경로 템플릿 하나로 모은다. */
export function joinRoutePath(base: string, handler: string): string {
    const segments = [base, handler]
        .flatMap((piece) => piece.split("/"))
        .map((piece) => piece.trim())
        .filter((piece) => piece.length > 0)
        .map(toPathTemplateSegment);
    return `/${segments.join("/")}`;
}

/** 표면 목록이 탐색 순서에 흔들리지 않도록 메서드와 경로의 사전순으로 세운다. */
export function sortServedRoutes(routes: readonly ServedRoute[]): readonly ServedRoute[] {
    return [...routes].sort((left, right) => (routeKey(left) < routeKey(right) ? -1 : 1));
}

function routeKey(route: ServedRoute): string {
    return `${route.method} ${route.path}`;
}

function toPathTemplateSegment(segment: string): string {
    if (!segment.startsWith(":")) return segment;
    return `{${segment.slice(1).replace(/[?*+]$/, "")}}`;
}
