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

    async checkpointRunning(_id: string, _attempt: number, draftText: string): Promise<boolean> {
        this.drafts.push(draftText);
        return Promise.resolve(true);
    }
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
