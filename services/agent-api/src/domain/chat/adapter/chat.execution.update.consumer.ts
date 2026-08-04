import os from "node:os";
import { logWarn } from "@tracer-agent/platform";
import { CHAT_EXECUTION_UPDATES_TOPIC } from "~agent-api/config/chat.queue.const.js";
import { createKafkaConsumer, type KafkaClient, type KafkaConsumer } from "~agent-api/config/kafka.factory.js";
import type { ChatExecutionEvents } from "./chat.execution.events.js";

/** 각 replica가 같은 신호를 받아 자기 프로세스의 열린 연결만 알린다. */
export class ChatExecutionUpdateConsumer {
    private readonly consumer: KafkaConsumer;

    constructor(kafka: KafkaClient, private readonly events: ChatExecutionEvents) {
        this.consumer = createKafkaConsumer(kafka, {
            groupId: `chat-updates-${instanceId()}`,
            fromBeginning: false,
        });
    }

    async start(): Promise<void> {
        await this.consumer.connect();
        await this.consumer.subscribe({ topics: [CHAT_EXECUTION_UPDATES_TOPIC] });
        await this.consumer.run({
            eachMessage: ({ message }) => {
                const executionId = parseExecutionId(message.value);
                if (executionId !== null) this.events.publish(executionId);
                return Promise.resolve();
            },
        });
    }

    async stop(): Promise<void> {
        await this.consumer.disconnect().catch(() => undefined);
    }
}

// 배포가 안정된 신원을 주지 않으면 재시작마다 새 컨슈머 그룹이 브로커에 쌓인다.
function instanceId(): string {
    return process.env["MONITOR_INSTANCE_ID"]?.trim() || `${os.hostname()}-${process.pid}`;
}

function parseExecutionId(value: Buffer | null): string | null {
    if (value === null) return null;
    try {
        const parsed: unknown = JSON.parse(value.toString("utf8"));
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
        const executionId = (parsed as Record<string, unknown>)["executionId"];
        return typeof executionId === "string" && executionId.trim() !== "" ? executionId : null;
    } catch {
        logWarn({ msg: "chat.execution_wakeup.invalid" });
        return null;
    }
}
