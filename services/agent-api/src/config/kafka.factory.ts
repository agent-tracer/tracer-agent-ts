import confluent from "@confluentinc/kafka-javascript";
import { loadApplicationConfig } from "@tracer-agent/platform";

const { Kafka, logLevel } = confluent.KafkaJS;

export type KafkaClient = confluent.KafkaJS.Kafka;
export type KafkaProducer = confluent.KafkaJS.Producer;
export type KafkaConsumer = confluent.KafkaJS.Consumer;

export interface KafkaConsumerOptions {
    readonly groupId: string;
    readonly fromBeginning: boolean;
}

export function createKafka(clientId: string): KafkaClient {
    const { kafka } = loadApplicationConfig();
    return new Kafka({ kafkaJS: { clientId, brokers: kafka.brokers, logLevel: logLevel.NOTHING } });
}

/** 컨슈머의 시작 오프셋은 구독이 아니라 생성 시점에 고정된다. */
export function createKafkaConsumer(kafka: KafkaClient, options: KafkaConsumerOptions): KafkaConsumer {
    return kafka.consumer({
        kafkaJS: { groupId: options.groupId, fromBeginning: options.fromBeginning },
    });
}
