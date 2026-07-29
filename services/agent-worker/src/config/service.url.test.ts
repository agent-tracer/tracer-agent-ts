import { afterEach, describe, expect, it } from "vitest";
import { resolveAgentApiUrl, resolveTracerApiUrl } from "./service.url.js";

describe("resolveTracerApiUrl", () => {
    afterEach(() => {
        delete process.env["TRACER_API_URL"];
        delete process.env["AGENT_API_URL"];
    });

    it("설정한 추적 API 기점을 그대로 쓴다", () => {
        process.env["TRACER_API_URL"] = "http://tracer-api:3902";
        expect(resolveTracerApiUrl()).toBe("http://tracer-api:3902");
    });

    it("설정이 없으면 루프백 주소로 되돌아간다", () => {
        expect(resolveTracerApiUrl()).toBe("http://127.0.0.1:3902");
    });

    it("에이전트 API 기점은 설정이 없으면 주어진 포트의 루프백을 쓴다", () => {
        expect(resolveAgentApiUrl(3904)).toBe("http://127.0.0.1:3904");
    });
});
