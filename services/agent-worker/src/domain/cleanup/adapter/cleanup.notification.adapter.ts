import type { NotificationPublisher } from "~agent-worker/config/notification.js";
import type { CleanupNotificationPort } from "~agent-worker/domain/cleanup/port/cleanup.notification.port.js";

/** 잡 상태 변화를 알림 토픽으로 발행한다. */
export class CleanupNotificationAdapter implements CleanupNotificationPort {
    constructor(private readonly publish: NotificationPublisher) {}

    async jobUpdated(userId: string, payload: Record<string, unknown>): Promise<void> {
        await this.publish(userId, payload);
    }
}
