import { JOB_UPDATED_NOTIFICATION, NOTIFICATIONS_TOPIC } from "./queue.const.js";
import type { KafkaProducer } from "./kafka.factory.js";

/** 잡 상태 변화를 알림 토픽으로 발행하며 유실을 허용한다. */
export type NotificationPublisher = (userId: string, payload: Record<string, unknown>) => Promise<void>;

export function createNotificationPublisher(producer: KafkaProducer): NotificationPublisher {
    return async (userId, payload) => {
        await producer.send({
            topic: NOTIFICATIONS_TOPIC,
            messages: [
                {
                    key: userId,
                    value: JSON.stringify({
                        userId,
                        notification: { type: JOB_UPDATED_NOTIFICATION, payload },
                    }),
                },
            ],
        });
    };
}
