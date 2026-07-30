import { describe, expect, it } from "vitest";
import { taskQueueName } from "./task.queue.js";

describe("taskQueueName", () => {
    it("접두사와 큐 키를 하이픈으로 이어 완전한 이름을 만든다", () => {
        expect(taskQueueName("agent", "chat")).toBe("agent-chat");
        expect(taskQueueName("agent", "jobs")).toBe("agent-jobs");
        expect(taskQueueName("agent", "generate")).toBe("agent-generate");
    });

    it("접두사가 다르면 같은 키라도 다른 큐를 가리킨다", () => {
        expect(taskQueueName("agent-ts", "chat")).toBe("agent-ts-chat");
    });
});
