import type {
    JobNotificationPort,
    NotificationPublish,
} from "~agent-worker/support/job.notification.port.js";

/** 잡 상태 변화를 알림 창구로 발행한다. */
export class JobNotification implements JobNotificationPort {
    constructor(private readonly publish: NotificationPublish) {}

    async jobUpdated(userId: string, payload: Record<string, unknown>): Promise<void> {
        await this.publish(userId, payload);
    }
}
