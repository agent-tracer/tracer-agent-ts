import { readContractJson } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import type { ChatSchedulerPort } from "~agent-worker/domain/chat/port/chat.execution.sink.port.js";
import type { ChatExecutionRepositoryPort } from "~agent-worker/domain/chat/port/chat.repository.port.js";
import {
    FixedClock,
    RecordingChatExecutionUpdates,
} from "~agent-worker/domain/chat/port/__fakes__/chat.test-support.js";
import { ChatExecutionSinkFactory } from "./chat.execution.sink.js";

interface RedactionRule {
    readonly marker: string;
    readonly values: { readonly requiresTrailingBody: { readonly minLength: number } };
}

const RULE = readContractJson<RedactionRule>("agent/shared/redaction.json");
const BODY = "A".repeat(RULE.values.requiresTrailingBody.minLength);

class RecordingExecutions {
    readonly drafts: string[] = [];
    readonly phases: string[] = [];

    async checkpointRunning(
        _id: string,
        _attempt: number,
        draftText: string,
        _draftSeq: number,
        phase: string,
    ): Promise<boolean> {
        this.drafts.push(draftText);
        this.phases.push(phase);
        return Promise.resolve(true);
    }
}

function recordingSink() {
    const executions = new RecordingExecutions();
    const factory = new ChatExecutionSinkFactory(
        executions as unknown as ChatExecutionRepositoryPort,
        new FixedClock(),
        IDLE_SCHEDULER,
        new RecordingChatExecutionUpdates(),
    );
    return { executions, handle: factory.create("exec-1", 1) };
}

// 시간이 흐르지 않는 대역이라 검사점은 flush 가 부를 때만 열린다.
const IDLE_SCHEDULER: ChatSchedulerPort = {
    schedule: () => ({}),
    cancel: () => undefined,
};

describe("사용자 화면으로 나가는 대화 초안", () => {
    it("모델이 흘린 자격 증명을 표시로 바꾸고 나머지 본문은 남긴다", async () => {
        const executions = new RecordingExecutions();
        const factory = new ChatExecutionSinkFactory(
            executions as unknown as ChatExecutionRepositoryPort,
            new FixedClock(),
            IDLE_SCHEDULER,
            new RecordingChatExecutionUpdates(),
        );
        const handle = factory.create("exec-1", 1);

        await handle.sink.onAssistantDelta(`키는 sk-ant-${BODY} 이다`);
        await handle.flush();
        handle.close();

        expect(executions.drafts).toEqual([`키는 ${RULE.marker} 이다`]);
    });
});

describe("실행이 무엇을 하는 중인지", () => {
    it("글자를 내지 않는 진행 신호만 와도 사고 중임을 원장에 남긴다", async () => {
        const { executions, handle } = recordingSink();

        handle.sink.onProgress?.();
        await handle.flush();
        handle.close();

        expect(executions.phases).toEqual(["thinking"]);
        expect(executions.drafts).toEqual([""]);
    });

    it("도구를 부르면 도구 구간으로 옮기고 결과가 와야 빠져나온다", async () => {
        const { executions, handle } = recordingSink();

        await handle.sink.onToolCall({ id: "call-1", name: "bash", args: {} });
        await handle.flush();
        await handle.sink.onToolResult({ toolCallId: "call-1", toolName: "bash", content: "" });
        await handle.flush();
        handle.close();

        expect(executions.phases).toEqual(["tool", "thinking"]);
    });

    it("답변이 흐르는 동안에는 진행 신호가 표시를 사고로 되돌리지 않는다", async () => {
        const { executions, handle } = recordingSink();

        await handle.sink.onAssistantDelta("답");
        await handle.flush();
        handle.sink.onProgress?.();
        await handle.flush();
        handle.close();

        expect(executions.phases).toEqual(["responding", "responding"]);
    });
});
