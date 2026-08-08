import { redactText } from "@tracer-agent/llm";
import { errorMessage, logWarn, type IClock } from "@tracer-agent/platform";
import { readChatDraftRules } from "~agent-worker/support/contract.js";
import {
    CHAT_EXECUTION_PHASE,
    type ChatExecutionPhase,
} from "~agent-worker/domain/chat/model/chat.const.js";
import type { ChatTurnToolCall } from "~agent-worker/domain/chat/model/chat.turn.model.js";
import type {
    ChatExecutionSinkFactoryPort,
    ChatExecutionSinkHandle,
    ChatExecutionUpdatePublisherPort,
    ChatSchedulerPort,
} from "~agent-worker/domain/chat/port/chat.execution.sink.port.js";
import type { ChatExecutionRepositoryPort } from "~agent-worker/domain/chat/port/chat.repository.port.js";

const DRAFT_RULES = readChatDraftRules();

/** 진행 표시에 남는 도구 한 줄이며 두 구현체가 같은 모양을 쓴다. */
export function toolMarker(toolName: string): string {
    return `\n\n\`${toolName}\`\n\n`;
}

export class ChatExecutionSinkFactory implements ChatExecutionSinkFactoryPort {
    constructor(
        private readonly executions: ChatExecutionRepositoryPort,
        private readonly clock: IClock,
        private readonly scheduler: ChatSchedulerPort,
        private readonly events: ChatExecutionUpdatePublisherPort,
    ) {}

    create(executionId: string, attempt: number): ChatExecutionSinkHandle {
        return new DurableChatExecutionSink(
            executionId,
            attempt,
            this.executions,
            this.clock,
            this.scheduler,
            this.events,
        );
    }
}

class DurableChatExecutionSink implements ChatExecutionSinkHandle {
    private text = "";
    private seq = 0;
    private phase: ChatExecutionPhase = CHAT_EXECUTION_PHASE.starting;
    private opened = false;
    private savedSeq = 0;
    /** 이미 큐에 얹어 둔 자리이며 실패하면 풀려 다시 적을 수 있게 한다. */
    private pendingSeq = 0;
    private timer: object | null = null;
    private tail: Promise<void> = Promise.resolve();

    readonly sink = {
        onAssistantDelta: (text: string) => this.push(text, CHAT_EXECUTION_PHASE.responding),
        // 사고 블록과 도구 인자는 글자를 내지 않으므로 무엇을 하는 중인지만 옮겨 화면이 멈추지 않게 한다.
        onProgress: () => this.enterPhase(CHAT_EXECUTION_PHASE.thinking),
        onToolCall: (call: ChatTurnToolCall) =>
            this.push(toolMarker(call.name), CHAT_EXECUTION_PHASE.tool),
        // 도구가 실행되는 동안 공급자가 아무 신호도 내지 않으므로 결과가 와야 다음 구간으로 넘어간다.
        onToolResult: () => this.enterPhase(CHAT_EXECUTION_PHASE.thinking),
    };

    constructor(
        private readonly executionId: string,
        private readonly attempt: number,
        private readonly executions: ChatExecutionRepositoryPort,
        private readonly clock: IClock,
        private readonly scheduler: ChatSchedulerPort,
        private readonly events: ChatExecutionUpdatePublisherPort,
    ) {}

    async flush(): Promise<void> {
        if (this.timer !== null) this.scheduler.cancel(this.timer);
        this.timer = null;
        this.enqueueFlush();
        await this.tail;
    }

    close(): void {
        if (this.timer !== null) this.scheduler.cancel(this.timer);
        this.timer = null;
    }

    private push(delta: string, phase: ChatExecutionPhase): void {
        this.text += delta;
        this.phase = phase;
        this.seq += 1;
        this.scheduleFlush();
    }

    /** 답변이 흐르는 중에는 사고로 되돌리지 않으므로 표시가 조각마다 흔들리지 않는다. */
    private enterPhase(phase: ChatExecutionPhase): void {
        if (this.phase === phase) return;
        if (phase === CHAT_EXECUTION_PHASE.thinking && this.phase === CHAT_EXECUTION_PHASE.responding) {
            return;
        }
        this.phase = phase;
        this.seq += 1;
        this.scheduleFlush();
    }

    /** 첫 조각은 곧바로 적고 그 뒤로만 묶어, 첫 글자가 스로틀만큼 늦지 않게 한다. */
    private scheduleFlush(): void {
        if (this.timer !== null) return;
        if (!this.opened) {
            this.opened = true;
            this.enqueueFlush();
        }
        this.timer = this.scheduler.schedule(DRAFT_RULES.intervalMs, () => {
            this.timer = null;
            if (this.seq > this.savedSeq) this.enqueueFlush();
        });
    }

    private enqueueFlush(): void {
        const text = redactText(this.text);
        const seq = this.seq;
        const phase = this.phase;
        if (seq === 0 || seq === this.pendingSeq) return;
        this.pendingSeq = seq;
        this.tail = this.tail.then(async () => {
            try {
                const saved = await this.executions.checkpointRunning(
                    this.executionId,
                    this.attempt,
                    text,
                    seq,
                    phase,
                    this.clock.now(),
                );
                this.savedSeq = seq;
                if (saved) this.events.publish(this.executionId);
            } catch (error) {
                // 예약을 풀어 다음 조각이나 마무리가 이 자리를 다시 적게 한다.
                if (this.pendingSeq === seq) this.pendingSeq = this.savedSeq;
                // 초안은 화면에 보이는 사본일 뿐이므로 여기서 턴을 실패로 접지 않는다.
                logWarn({
                    msg: "chat.checkpoint.failed",
                    executionId: this.executionId,
                    attempt: this.attempt,
                    draftSeq: seq,
                    error: errorMessage(error),
                });
            }
        });
    }
}
