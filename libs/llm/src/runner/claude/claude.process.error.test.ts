import { describe, expect, it, vi } from "vitest";

const logWarnMock = vi.fn<(fields: Record<string, unknown>) => void>();

vi.mock("@tracer-agent/platform", () => ({
    logWarn: (fields: Record<string, unknown>): void => logWarnMock(fields),
}));

const { ProcessErrorOutput } = await import("./claude.process.error.js");

describe("하위 프로세스의 오류 출력", () => {
    it("실행이 성공하면 남기지 않는다", () => {
        logWarnMock.mockClear();
        const output = new ProcessErrorOutput();
        output.append("warning: something");

        output.report("test-agent", null, null);

        expect(logWarnMock).not.toHaveBeenCalled();
    });

    it("모은 것이 없으면 실행이 실패해도 남기지 않는다", () => {
        logWarnMock.mockClear();

        new ProcessErrorOutput().report("test-agent", null, "process_error");

        expect(logWarnMock).not.toHaveBeenCalled();
    });

    it("실행이 실패하면 모은 출력을 오류 분류와 함께 남긴다", () => {
        logWarnMock.mockClear();
        const output = new ProcessErrorOutput();
        output.append("spawn failed\n");

        output.report("test-agent", "job-1", "process_error");

        expect(logWarnMock).toHaveBeenCalledWith(
            expect.objectContaining({
                msg: "agent.query.process_stderr",
                label: "test-agent",
                jobId: "job-1",
                errorSubtype: "process_error",
                stderr: "spawn failed",
            }),
        );
    });

    it("자격 증명이 섞여 있으면 가린 뒤 남긴다", () => {
        logWarnMock.mockClear();
        const output = new ProcessErrorOutput();
        output.append("api_key=sk-ant-super-secret-value-1234567890");

        output.report("test-agent", null, "process_error");

        const [fields] = logWarnMock.mock.calls[0]!;
        expect(fields["stderr"]).not.toContain("sk-ant-super-secret-value-1234567890");
    });

    it("출력이 길면 진단에 쓰는 꼬리만 들고 있는다", () => {
        logWarnMock.mockClear();
        const output = new ProcessErrorOutput();
        output.append("x".repeat(5000));
        output.append("마지막 줄");

        output.report("test-agent", null, "process_error");

        const [fields] = logWarnMock.mock.calls[0]!;
        expect(String(fields["stderr"]).length).toBeLessThanOrEqual(4000);
        expect(String(fields["stderr"])).toContain("마지막 줄");
    });
});
