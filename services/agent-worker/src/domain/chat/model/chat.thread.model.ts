/** 한 사용자의 대화 묶음이며 제목과 요약과 마지막 턴을 실행한 구현체를 든다. */
export class ChatThread {
    id!: string;

    userId!: string;

    title!: string;

    summary!: string | null;

    /** 그 요약이 접은 마지막 메시지이며 요약과 짝을 이뤄 원장의 CHECK 제약이 그 짝을 강제한다. */
    summaryThroughMessageId!: string | null;

    /** 이 스레드에서 마지막으로 턴을 실행한 구현체이며 첫 턴 전에는 아직 없어 null이다. */
    implementation!: string | null;

    createdAt!: Date;

    updatedAt!: Date;

    rename(title: string, now: Date): void {
        this.title = title;
        this.updatedAt = now;
    }

    /** 요약과 그 지점을 한 문장으로 갱신하며 따로 쓰면 그 사이에 읽는 쪽이 짝이 어긋난 행을 본다. */
    updateSummary(summary: string, throughMessageId: string, now: Date): void {
        this.summary = summary;
        this.summaryThroughMessageId = throughMessageId;
        this.updatedAt = now;
    }

    recordTurn(implementation: string, now: Date): void {
        this.implementation = implementation;
        this.updatedAt = now;
    }

    isOwnedBy(userId: string): boolean {
        return this.userId === userId;
    }
}
