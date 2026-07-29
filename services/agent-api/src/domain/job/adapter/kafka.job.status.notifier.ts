import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { logWarn } from "@tracer-agent/platform";
import { AGENT_KAFKA } from "~agent-api/config/agent.datasource.token.js";
import { JOB_UPDATED_NOTIFICATION, NOTIFICATIONS_TOPIC } from "~agent-api/config/job.queue.const.js";
import type { KafkaClient, KafkaProducer } from "~agent-api/config/kafka.factory.js";
import type { JobStatusChange, JobStatusNotifier } from "~agent-api/domain/job/port/job.status.notifier.port.js";

/** 소켓은 추적 서비스가 들고 있으므로 잡 상태 전이를 알림 토픽으로 실어 보낸다. */
@Injectable()
export class KafkaJobStatusNotifier implements JobStatusNotifier, OnModuleDestroy {
    private readonly producer: KafkaProducer;
    private connected: Promise<void> | null = null;

    constructor(@Inject(AGENT_KAFKA) kafka: KafkaClient) {
        this.producer = kafka.producer();
    }

    notify(userId: string, change: JobStatusChange): void {
        void this.send(userId, change);
    }

    async onModuleDestroy(): Promise<void> {
        if (this.connected === null) return;
        await this.connected.catch(() => undefined);
        await this.producer.disconnect().catch(() => undefined);
    }

    private async send(userId: string, change: JobStatusChange): Promise<void> {
        const envelope = {
            userId,
            notification: {
                type: JOB_UPDATED_NOTIFICATION,
                payload: {
                    jobId: change.jobId,
                    kind: change.kind,
                    status: change.status,
                    ...(change.taskId !== undefined ? { taskId: change.taskId } : {}),
                },
            },
        };
        try {
            await this.connect();
            await this.producer.send({
                topic: NOTIFICATIONS_TOPIC,
                messages: [{ key: userId, value: JSON.stringify(envelope) }],
            });
        } catch {
            // 알림은 상태 정합성과 무관한 유실 허용 신호다.
            logWarn({ msg: "job.status_notice.publish_failed", jobId: change.jobId });
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
