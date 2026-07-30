import { describe, expect, it } from "vitest";
import { generateTaskQueueOf, taskQueueName } from "./task.queue.js";

describe("taskQueueName", () => {
    it("접두사와 큐 키를 하이픈으로 이어 완전한 이름을 만든다", () => {
        expect(taskQueueName("agent", "chat")).toBe("agent-chat");
        expect(taskQueueName("agent", "jobs")).toBe("agent-jobs");
        expect(taskQueueName("agent", "generate")).toBe("agent-generate");
    });

    it("접두사가 다르면 같은 키라도 다른 큐를 가리킨다", () => {
        expect(taskQueueName("agent-ts", "jobs")).toBe("agent-ts-jobs");
    });
});

describe("generateTaskQueueOf", () => {
    it("워크플로가 도는 큐의 접두사를 그대로 물려 생성 큐를 가리킨다", () => {
        expect(generateTaskQueueOf("agent-jobs")).toBe("agent-generate");
        expect(generateTaskQueueOf("agent-ts-jobs")).toBe("agent-ts-generate");
    });

    it("이미 생성 큐에서 도는 워크플로도 같은 생성 큐를 가리킨다", () => {
        expect(generateTaskQueueOf("agent-generate")).toBe("agent-generate");
    });
});
