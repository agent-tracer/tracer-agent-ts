import type {
    ChatTurnSink,
    ChatTurnToolCall,
    ChatTurnToolResult,
} from "./chat.turn.model.js";

/** 실행이 살아 있는지가 아니라 실제로 나아가고 있는지를 재는 시계다. */
export interface ProgressClock {
    nowMs(): number;
}

/** 토큰과 도구 사건을 진행 신호로 삼아 마지막 진행 이후 stallMs가 지나면 멈춘 것으로 본다. */
export class ChatStallWatch {
    private lastProgressMs: number;

    constructor(
        private readonly clock: ProgressClock,
        private readonly stallMs: number,
    ) {
        this.lastProgressMs = clock.nowMs();
    }

    /** 감싼 싱크로 흐르는 모든 사건이 진행으로 기록된다. */
    wrap(sink: ChatTurnSink): ChatTurnSink {
        const mark = (): void => this.markProgress();
        return {
            onProgress: () => {
                mark();
                sink.onProgress?.();
            },
            onAssistantDelta: (text: string) => {
                mark();
                return sink.onAssistantDelta(text);
            },
            onToolCall: (call: ChatTurnToolCall) => {
                mark();
                return sink.onToolCall(call);
            },
            onToolResult: (result: ChatTurnToolResult) => {
                mark();
                return sink.onToolResult(result);
            },
        };
    }

    markProgress(): void {
        this.lastProgressMs = this.clock.nowMs();
    }

    isStalled(): boolean {
        return this.clock.nowMs() - this.lastProgressMs >= this.stallMs;
    }
}
