import { describe, expect, it } from "vitest";
import type { KafkaProducer } from "~agent-worker/config/kafka.factory.js";
import { createNotificationPublisher } from "~agent-worker/config/notification.js";
import { JOB_UPDATED_NOTIFICATION, NOTIFICATIONS_TOPIC } from "~agent-worker/config/queue.const.js";
import { readNotificationTopic } from "~agent-worker/support/contract.js";

type SentRecord = { readonly topic: string; readonly messages: readonly { readonly key: string; readonly value: string }[] };

function recordingProducer(sent: SentRecord[]): KafkaProducer {
    return {
        send: (record: SentRecord) => {
            sent.push(record);
            return Promise.resolve();
        },
    } as unknown as KafkaProducer;
}

describe("워커가 발행하는 알림", () => {
    it("토픽의 이름은 계약이 선언한 이름과 같다", () => {
        expect(NOTIFICATIONS_TOPIC).toBe(readNotificationTopic().name);
    });

    it("잡 갱신 알림의 종류는 계약이 선언한 이름과 같다", () => {
        expect(JOB_UPDATED_NOTIFICATION).toBe(readNotificationTopic().types.jobUpdated.name);
    });

    it("발행한 봉투는 계약이 선언한 칸을 갖고 계약이 정한 키로 나뉜다", async () => {
        const topic = readNotificationTopic();
        const sent: SentRecord[] = [];

        await createNotificationPublisher(recordingProducer(sent))("user-1", {
            jobId: "job-1",
            kind: "recipe.scan",
            status: "completed",
        });

        const envelope = JSON.parse(sent[0]?.messages[0]?.value ?? "{}") as Record<string, unknown>;
        expect(sent[0]?.topic).toBe(topic.name);
        expect(sent[0]?.messages[0]?.key).toBe(envelope[topic.key]);
        expect(Object.keys(envelope).sort()).toEqual(Object.keys(topic.payload).sort());
    });
});
