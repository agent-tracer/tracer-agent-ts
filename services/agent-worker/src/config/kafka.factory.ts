import confluent from "@confluentinc/kafka-javascript";
import { loadApplicationConfig } from "@tracer-agent/platform";

const { Kafka, logLevel } = confluent.KafkaJS;

export type KafkaClient = confluent.KafkaJS.Kafka;
export type KafkaProducer = confluent.KafkaJS.Producer;

export function createKafka(clientId: string): KafkaClient {
    const { kafka } = loadApplicationConfig();
    return new Kafka({ kafkaJS: { clientId, brokers: kafka.brokers, logLevel: logLevel.NOTHING } });
}
