import { JOB_STEP_ORCHESTRATION_EVENT_KIND } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import {
    pushRouteSelected,
    pushValidationFailed,
    withNodeTrajectory,
    type RunSegment,
} from "./run.segment.js";

const NODE_NAMES = ["survey", "probe", "investigate", "repair", "validate_candidate"] as const;

function eventKinds(segments: readonly RunSegment[], nodeName: string): readonly (string | undefined)[] {
    return segments
        .flatMap((segment) => segment.steps)
        .filter((step) => step.nodeName === nodeName)
        .map((step) => step.eventKind);
}

describe("오케스트레이션 노드 궤적", () => {
    it.each(NODE_NAMES)("%s 노드가 성공하면 진입과 완료를 궤적에 남긴다", async (nodeName) => {
        const segments: RunSegment[] = [];

        const result = await withNodeTrajectory(segments, "recipe-scan", nodeName, () =>
            Promise.resolve("done"),
        );

        expect(result).toBe("done");
        expect(eventKinds(segments, nodeName)).toEqual([
            JOB_STEP_ORCHESTRATION_EVENT_KIND.nodeStarted,
            JOB_STEP_ORCHESTRATION_EVENT_KIND.nodeCompleted,
        ]);
    });

    it.each(NODE_NAMES)("%s 노드가 무너지면 진입과 실패를 남기고 다시 던진다", async (nodeName) => {
        const segments: RunSegment[] = [];
        const failure = new Error("boom");

        await expect(
            withNodeTrajectory(segments, "recipe-scan", nodeName, () => Promise.reject(failure)),
        ).rejects.toBe(failure);

        expect(eventKinds(segments, nodeName)).toEqual([
            JOB_STEP_ORCHESTRATION_EVENT_KIND.nodeStarted,
            JOB_STEP_ORCHESTRATION_EVENT_KIND.nodeFailed,
        ]);
    });

    it("조율자가 고른 경로를 route.selected로 남긴다", () => {
        const segments: RunSegment[] = [];

        pushRouteSelected(segments, "survey", "survey -> timeline:2");

        expect(eventKinds(segments, "survey")).toEqual([JOB_STEP_ORCHESTRATION_EVENT_KIND.routeSelected]);
    });

    it("검증이 걸어낸 사유를 validation.failed로 남긴다", () => {
        const segments: RunSegment[] = [];

        pushValidationFailed(segments, "validate_candidate", "citation missing");

        expect(eventKinds(segments, "validate_candidate")).toEqual([
            JOB_STEP_ORCHESTRATION_EVENT_KIND.validationFailed,
        ]);
    });
});
