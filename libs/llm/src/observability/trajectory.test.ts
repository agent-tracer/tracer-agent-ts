import { describe, expect, it } from "vitest";
import { TrajectoryRecorder } from "./trajectory.js";

function movableClock(): { nowMs: () => number; advance: (ms: number) => void } {
    let ms = 0;
    return { nowMs: () => ms, advance: (delta) => { ms += delta; } };
}

describe("TrajectoryRecorder", () => {
    it("스텝마다 직전 스텝 이후 흐른 시간을 남긴다", () => {
        const clock = movableClock();
        const recorder = new TrajectoryRecorder(clock.nowMs);

        clock.advance(12_000);
        recorder.assistant({ content: "태스크를 찾아볼게요" });
        clock.advance(118_000);
        recorder.tool({ toolName: "search_tasks", toolCallId: "call-1", content: "결과" });

        const steps = recorder.snapshot();
        expect(steps.map((step) => step.durationMs)).toEqual([12_000, 118_000]);
        // 어느 호출이 시간을 먹었는지 궤적만 보고 답할 수 있어야 한다.
        expect(steps[1]?.toolName).toBe("search_tasks");
    });

    it("궤적에 실리지 않은 빈 응답은 다음 스텝의 시간에 포함된다", () => {
        const clock = movableClock();
        const recorder = new TrajectoryRecorder(clock.nowMs);

        clock.advance(5_000);
        recorder.assistant({ content: "" });
        clock.advance(7_000);
        recorder.assistant({ content: "답변" });

        const steps = recorder.snapshot();
        expect(steps).toHaveLength(1);
        expect(steps[0]?.durationMs).toBe(12_000);
    });
});
