import { errorMessage, logError } from "@tracer-agent/platform";
import type { SearchOutboxDrainRunnerPort } from "~agent-api/domain/recipe/port/search.outbox.drain.port.js";
import { readSearchDrain } from "~agent-api/support/contract.js";

/** 배출 주기이며 두 구현체가 각자 적으면 같은 쓰기가 축마다 다른 시간 뒤에 검색에 보인다. */
export const DRAIN_INTERVAL_MS = readSearchDrain().intervalMs;

/** 배출을 주기로 부르며 한 주기의 실패가 다음 주기를 멈추지 않게 한다. */
export class SearchOutboxDrainScheduler {
    private timer: NodeJS.Timeout | null = null;

    private running = false;

    constructor(private readonly drain: SearchOutboxDrainRunnerPort) {}

    /** 배출이 이 프로세스가 하는 일이므로 주기 타이머가 이벤트 루프를 잡아 둔다. */
    start(): void {
        if (this.timer !== null) return;
        this.timer = setInterval(() => void this.tick(), DRAIN_INTERVAL_MS);
    }

    stop(): void {
        if (this.timer === null) return;
        clearInterval(this.timer);
        this.timer = null;
    }

    /** 앞 주기가 아직 돌고 있으면 겹쳐 부르지 않는다. */
    private async tick(): Promise<void> {
        if (this.running) return;
        this.running = true;
        try {
            await this.drain.runOnce();
        } catch (error) {
            logError({ msg: "search.outbox_drain.crashed", error: errorMessage(error) });
        } finally {
            this.running = false;
        }
    }
}
