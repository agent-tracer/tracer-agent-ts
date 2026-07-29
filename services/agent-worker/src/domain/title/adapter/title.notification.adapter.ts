import type { NotificationPublisher } from "~agent-worker/config/notification.js";
import type { TitleNotificationPort } from "~agent-worker/domain/title/port/title.notification.port.js";

/** 잡 상태 변화를 알림 토픽으로 발행한다. */
export class TitleNotificationAdapter implements TitleNotificationPort {
    constructor(private readonly publish: NotificationPublisher) {}

    async jobUpdated(userId: string, payload: Record<string, unknown>): Promise<void> {
        await this.publish(userId, payload);
    }
}
