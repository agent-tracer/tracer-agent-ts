/** 한 사용자의 대화 묶음이며 제목과 요약과 마지막 턴을 실행한 구현체를 든다. */
export class ChatThread {
    id!: string;

    userId!: string;

    title!: string;

    summary!: string | null;

    /** 이 스레드에서 마지막으로 턴을 실행한 구현체이며 첫 턴 전에는 아직 없어 null이다. */
    implementation!: string | null;

    createdAt!: Date;

    updatedAt!: Date;

    rename(title: string, now: Date): void {
        this.title = title;
        this.updatedAt = now;
    }

    updateSummary(summary: string, now: Date): void {
        this.summary = summary;
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
