import { describe, expect, it } from "vitest";
import { JOB_UPDATED_NOTIFICATION, NOTIFICATIONS_TOPIC } from "~agent-api/config/job.queue.const.js";
import { readNotificationTopic } from "~agent-api/support/contract.js";

describe("접수가 발행하는 알림", () => {
    it("토픽의 이름은 계약이 선언한 이름과 같다", () => {
        expect(NOTIFICATIONS_TOPIC).toBe(readNotificationTopic().name);
    });

    it("잡 갱신 알림의 종류는 계약이 선언한 이름과 같다", () => {
        expect(JOB_UPDATED_NOTIFICATION).toBe(readNotificationTopic().types.jobUpdated.name);
    });
});
