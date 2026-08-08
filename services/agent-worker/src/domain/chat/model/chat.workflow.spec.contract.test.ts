import { describe, expect, it } from "vitest";
import { readContractYaml } from "~agent-worker/support/contract.js";
import {
    CHAT_RUNNING_LEASE_MS,
    CHAT_THREAD_BUSY_FAILURE,
    CHAT_THREAD_BUSY_MAX_ROUNDS,
    CHAT_THREAD_BUSY_RETRY_MS,
    CHAT_THREAD_MAX_CHILDREN,
} from "./chat.workflow.spec.js";

interface QueuesDeclaration {
    readonly workflows: { readonly chatThread: { readonly maxChildren: number } };
    readonly leases: {
        readonly chatRunningMs: number;
        readonly threadBusyRetryMs: number;
        readonly threadBusyMaxRounds: number;
        readonly threadBusyFailure: string;
    };
}

const DECLARED = readContractYaml<QueuesDeclaration>("workflow/queues.yaml");

// 워크플로 번들은 샌드박스라 계약을 읽지 못해 값을 코드에 두므로, 갈라지는 것은 이 자리가 막는다.
describe("스레드 워크플로 상수와 계약", () => {
    it("자식 상한을 계약이 적은 수와 같이 갖는다", () => {
        expect(CHAT_THREAD_MAX_CHILDREN).toBe(DECLARED.workflows.chatThread.maxChildren);
    });

    it("실행 임차 수명을 계약이 적은 값과 같이 갖는다", () => {
        expect(CHAT_RUNNING_LEASE_MS).toBe(DECLARED.leases.chatRunningMs);
    });

    it("스레드가 잠겼을 때 다시 보는 간격을 계약이 적은 값과 같이 갖는다", () => {
        expect(CHAT_THREAD_BUSY_RETRY_MS).toBe(DECLARED.leases.threadBusyRetryMs);
    });

    it("스레드가 잠겼을 때 다시 보는 횟수를 계약이 적은 값과 같이 갖는다", () => {
        expect(CHAT_THREAD_BUSY_MAX_ROUNDS).toBe(DECLARED.leases.threadBusyMaxRounds);
    });

    it("스레드가 잠겨 실패할 때의 사유를 계약이 적은 글자와 같이 갖는다", () => {
        expect(CHAT_THREAD_BUSY_FAILURE).toBe(DECLARED.leases.threadBusyFailure);
    });

    it("다시 보는 간격과 횟수를 곱한 시간이 임차 수명보다 길어 잠긴 스레드가 풀리는 것을 본다", () => {
        expect(CHAT_THREAD_BUSY_RETRY_MS * CHAT_THREAD_BUSY_MAX_ROUNDS).toBeGreaterThan(CHAT_RUNNING_LEASE_MS);
    });
});
