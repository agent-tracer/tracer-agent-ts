import { afterEach, describe, expect, it, vi } from "vitest";

async function loadQueueNames(prefix?: string) {
    vi.resetModules();
    if (prefix === undefined) delete process.env["AGENT_TASK_QUEUE_PREFIX"];
    else process.env["AGENT_TASK_QUEUE_PREFIX"] = prefix;
    const [chat, job] = await Promise.all([
        import("./chat.queue.const.js"),
        import("./job.queue.const.js"),
    ]);
    return { ...chat, ...job };
}

describe("접수가 워크플로를 띄우는 큐 이름", () => {
    afterEach(() => {
        delete process.env["AGENT_TASK_QUEUE_PREFIX"];
    });

    it("배포가 준 접두사와 큐 키에서 만들어진다", async () => {
        const queues = await loadQueueNames("agent-ts");
        expect(queues.CHAT_EXECUTION_TASK_QUEUE).toBe("agent-ts-chat");
        expect(queues.JOB_TASK_QUEUE).toBe("agent-ts-jobs");
        expect(queues.GENERATE_TASK_QUEUE).toBe("agent-ts-generate");
    });

    it("배포가 접두사를 주지 않으면 워커와 같은 기본 접두사를 쓴다", async () => {
        const queues = await loadQueueNames();
        expect(queues.CHAT_EXECUTION_TASK_QUEUE).toBe("agent-chat");
        expect(queues.JOB_TASK_QUEUE).toBe("agent-jobs");
        expect(queues.GENERATE_TASK_QUEUE).toBe("agent-generate");
    });
});
