import type { IClock } from "@tracer-agent/platform";
import type { ChatTurnToolCall } from "~agent-worker/domain/chat/model/chat.turn.model.js";
import type {
    ChatExecutionSinkFactoryPort,
    ChatExecutionSinkHandle,
    ChatExecutionUpdatePublisherPort,
    ChatSchedulerPort,
} from "~agent-worker/domain/chat/port/chat.execution.sink.port.js";
import type { ChatExecutionRepositoryPort } from "~agent-worker/domain/chat/port/chat.repository.port.js";

const DRAFT_CHECKPOINT_INTERVAL_MS = 150;

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
    private timer: object | null = null;
    private tail: Promise<void> = Promise.resolve();

    readonly sink = {
        onAssistantDelta: (text: string) => this.push(text),
        // 도구가 도는 동안 draft가 멈추면 화면도 멈춰 사용자가 실행이 끝난 줄 안다.
        onToolCall: (call: ChatTurnToolCall) => this.push(toolMarker(call.name)),
        onToolResult: () => undefined,
        onMemoryUpdated: () => this.events.publish(this.executionId),
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

    private push(delta: string): void {
        this.text += delta;
        this.seq += 1;
        if (this.timer !== null) return;
        this.timer = this.scheduler.schedule(DRAFT_CHECKPOINT_INTERVAL_MS, () => {
            this.timer = null;
            this.enqueueFlush();
        });
    }

    private enqueueFlush(): void {
        const text = this.text;
        const seq = this.seq;
        if (seq === 0) return;
        this.tail = this.tail.catch(() => undefined).then(async () => {
            const saved = await this.executions.checkpointRunning(
                this.executionId,
                this.attempt,
                text,
                seq,
                this.clock.now(),
            );
            if (saved) this.events.publish(this.executionId);
        });
    }
}
