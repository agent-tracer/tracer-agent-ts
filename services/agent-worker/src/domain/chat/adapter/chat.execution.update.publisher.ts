import { logWarn } from "@tracer-agent/platform";
import { CHAT_EXECUTION_UPDATES_TOPIC } from "~agent-worker/config/queue.const.js";
import type { KafkaProducer } from "~agent-worker/config/kafka.factory.js";
import type { ChatExecutionUpdatePublisherPort } from "~agent-worker/domain/chat/port/chat.execution.sink.port.js";

/** 이 워커에는 열린 연결이 없으므로 접수 replica에 알리는 신호만 발행한다. */
export class ChatExecutionUpdatePublisher implements ChatExecutionUpdatePublisherPort {
    constructor(private readonly producer: KafkaProducer) {}

    publish(executionId: string): void {
        void this.send(executionId);
    }

    private async send(executionId: string): Promise<void> {
        try {
            await this.producer.send({
                topic: CHAT_EXECUTION_UPDATES_TOPIC,
                messages: [{ key: executionId, value: JSON.stringify({ executionId }) }],
            });
        } catch {
            logWarn({ msg: "chat.execution_wakeup.publish_failed", executionId });
        }
    }
}
