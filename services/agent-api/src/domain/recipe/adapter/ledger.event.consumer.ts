import { errorMessage, logError, logWarn } from "@tracer-agent/platform";
import {
    LEDGER_EVENTS_CONSUMER_GROUP,
    LEDGER_EVENTS_TOPIC,
} from "~agent-api/config/ledger.topic.const.js";
import { createKafkaConsumer, type KafkaClient, type KafkaConsumer } from "~agent-api/config/kafka.factory.js";
import { parseLedgerRecord } from "~agent-api/domain/recipe/model/ledger.record.js";
import type { LedgerEventHandlerPort } from "~agent-api/domain/recipe/port/ledger.event.handler.port.js";

/** 추적이 소유한 사건 스트림을 자기 소비자 그룹으로 읽어 투영에 넘긴다. */
export class LedgerEventConsumer {
    private readonly consumer: KafkaConsumer;

    constructor(kafka: KafkaClient, private readonly handler: LedgerEventHandlerPort) {
        this.consumer = createKafkaConsumer(kafka, {
            groupId: LEDGER_EVENTS_CONSUMER_GROUP,
            fromBeginning: true,
        });
    }

    async start(): Promise<void> {
        await this.consumer.connect();
        await this.consumer.subscribe({ topics: [LEDGER_EVENTS_TOPIC] });
        await this.consumer.run({
            eachMessage: async ({ message }) => {
                const record = parseLedgerRecord(parseJson(message.value));
                if (record === null) {
                    logWarn({ msg: "ledger.event_stream.unreadable" });
                    return;
                }
                try {
                    await this.handler.handle(record);
                } catch (error) {
                    // 배달이 적어도 한 번이므로 실패한 사건은 다시 배달되어 같은 투영을 다시 시도한다.
                    logError({ msg: "ledger.event_projection.failed", error: errorMessage(error) });
                    throw error;
                }
            },
        });
    }

    async stop(): Promise<void> {
        await this.consumer.disconnect().catch(() => undefined);
    }
}

function parseJson(value: Buffer | null): unknown {
    if (value === null) return null;
    try {
        return JSON.parse(value.toString("utf8"));
    } catch {
        return null;
    }
}
