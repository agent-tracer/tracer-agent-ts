import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { logWarn } from "@tracer-agent/platform";
import { AGENT_KAFKA } from "~agent-api/config/agent.datasource.token.js";
import { CHAT_EXECUTION_UPDATES_TOPIC } from "~agent-api/config/chat.queue.const.js";
import type { KafkaClient, KafkaProducer } from "~agent-api/config/kafka.factory.js";
import type { ChatExecutionUpdatePublisherPort } from "~agent-api/domain/chat/port/chat.execution.update.port.js";
import { ChatExecutionEvents } from "./chat.execution.events.js";

/** 이 프로세스의 열린 연결에는 즉시 알리고 다른 replica에는 식별자만 전달한다. */
@Injectable()
export class ChatExecutionUpdatePublisher implements ChatExecutionUpdatePublisherPort, OnModuleDestroy {
    private readonly producer: KafkaProducer;
    private connected: Promise<void> | null = null;

    constructor(
        @Inject(AGENT_KAFKA) kafka: KafkaClient,
        private readonly events: ChatExecutionEvents,
    ) {
        this.producer = kafka.producer();
    }

    publish(executionId: string): void {
        this.events.publish(executionId);
        void this.send(executionId);
    }

    async onModuleDestroy(): Promise<void> {
        if (this.connected === null) return;
        await this.connected.catch(() => undefined);
        await this.producer.disconnect().catch(() => undefined);
    }

    private async send(executionId: string): Promise<void> {
        try {
            await this.connect();
            await this.producer.send({
                topic: CHAT_EXECUTION_UPDATES_TOPIC,
                messages: [{ key: executionId, value: JSON.stringify({ executionId }) }],
            });
        } catch {
            logWarn({ msg: "chat.execution_wakeup.publish_failed", executionId });
        }
    }

    private connect(): Promise<void> {
        if (this.connected === null) {
            this.connected = this.producer.connect().catch((error: unknown) => {
                this.connected = null;
                throw error;
            });
        }
        return this.connected;
    }
}
