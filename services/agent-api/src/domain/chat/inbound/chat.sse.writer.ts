import type { Response } from "express";

/** 이벤트 프레임을 순서대로 쓰되, 커널 송신 버퍼가 차면 비워질 때까지 다음 쓰기를 미뤄 역압력을 상류로 전한다. */
export class SseWriter {
    private tail: Promise<void> = Promise.resolve();
    private closed = false;
    private readonly drainWaiters = new Set<() => void>();

    constructor(private readonly res: Response) {}

    /** 이벤트를 직렬로 큐잉하고, 이 쓰기가 소켓으로 빠져나갈 때 이행되는 Promise를 준다. */
    write(event: string, data: unknown, id?: string): Promise<void> {
        this.tail = this.tail.then(() => this.flush(event, data, id));
        return this.tail;
    }

    /** 연결이 닫혔음을 알려 대기 중인 쓰기를 깨우고 이후 쓰기를 무력화한다. */
    close(): void {
        if (this.closed) return;
        this.closed = true;
        for (const wake of this.drainWaiters) wake();
        this.drainWaiters.clear();
    }

    private flush(event: string, data: unknown, id?: string): Promise<void> {
        if (this.closed) return Promise.resolve();
        const idLine = id === undefined ? "" : `id: ${id}\n`;
        const ok = this.res.write(`${idLine}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        // write가 false면 커널 버퍼가 찼다는 뜻이라, 닫힌 소켓에 계속 쓰지 않도록 비워질 때까지 기다린다.
        if (ok) return Promise.resolve();
        return new Promise<void>((resolve) => {
            const wake = (): void => {
                this.res.off("drain", wake);
                this.drainWaiters.delete(wake);
                resolve();
            };
            this.drainWaiters.add(wake);
            this.res.once("drain", wake);
        });
    }
}
