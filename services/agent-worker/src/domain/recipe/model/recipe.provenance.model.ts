import type { RecipeSlimEvent } from "./recipe.event.model.js";

export interface ProvenanceSnapshot {
    readonly eventIdsByTask: Readonly<Record<string, readonly string[]>>;
    readonly turnIdsByTask: Readonly<Record<string, readonly string[]>>;
    readonly ruleIds: readonly string[];
    readonly recipeRevs: Readonly<Record<string, number>>;
}

/** 최종 출력이 인용할 수 있는 실행 내 도구 관측 ID를 모은다. */
export class ProvenanceLedger {
    private readonly eventIdsByTask = new Map<string, Set<string>>();
    private readonly turnIdsByTask = new Map<string, Set<string>>();
    private readonly ruleIds = new Set<string>();
    private readonly recipeRevs = new Map<string, number>();

    /** 원장에서 되살린 스냅숏으로 장부를 다시 세운다. */
    static from(snapshot: ProvenanceSnapshot): ProvenanceLedger {
        const ledger = new ProvenanceLedger();
        for (const [taskId, ids] of Object.entries(snapshot.eventIdsByTask)) {
            ledger.eventIdsByTask.set(taskId, new Set(ids));
        }
        for (const [taskId, ids] of Object.entries(snapshot.turnIdsByTask)) {
            ledger.turnIdsByTask.set(taskId, new Set(ids));
        }
        ledger.recordRules(snapshot.ruleIds);
        for (const [recipeId, rev] of Object.entries(snapshot.recipeRevs)) ledger.recordRecipe(recipeId, rev);
        return ledger;
    }

    /** 도구가 모델에게 돌려준 이벤트만 받아 그 이벤트가 실은 턴까지 함께 검증 대상에 올린다. */
    recordEvents(taskId: string, events: readonly RecipeSlimEvent[]): void {
        if (events.length === 0) return;
        const ids = this.eventIdsByTask.get(taskId) ?? new Set<string>();
        const turns = this.turnIdsByTask.get(taskId) ?? new Set<string>();
        for (const event of events) {
            ids.add(event.id);
            if (event.turnId !== undefined) turns.add(event.turnId);
        }
        this.eventIdsByTask.set(taskId, ids);
        if (turns.size > 0) this.turnIdsByTask.set(taskId, turns);
    }

    recordRules(ruleIds: readonly string[]): void {
        for (const id of ruleIds) this.ruleIds.add(id);
    }

    recordRecipe(recipeId: string, rev: number): void {
        this.recipeRevs.set(recipeId, rev);
    }

    /** 전문가별 장부를 조율자 장부로 합칠 때 다른 장부가 모은 것을 이 장부로 병합한다. */
    mergeFrom(other: ProvenanceLedger): void {
        const seen = other.snapshot();
        for (const [taskId, ids] of Object.entries(seen.eventIdsByTask)) {
            const set = this.eventIdsByTask.get(taskId) ?? new Set<string>();
            for (const id of ids) set.add(id);
            this.eventIdsByTask.set(taskId, set);
        }
        for (const [taskId, ids] of Object.entries(seen.turnIdsByTask)) {
            const set = this.turnIdsByTask.get(taskId) ?? new Set<string>();
            for (const id of ids) set.add(id);
            this.turnIdsByTask.set(taskId, set);
        }
        this.recordRules(seen.ruleIds);
        for (const [recipeId, rev] of Object.entries(seen.recipeRevs)) this.recordRecipe(recipeId, rev);
    }

    snapshot(): ProvenanceSnapshot {
        return {
            eventIdsByTask: collect(this.eventIdsByTask),
            turnIdsByTask: collect(this.turnIdsByTask),
            ruleIds: [...this.ruleIds],
            recipeRevs: Object.fromEntries(this.recipeRevs),
        };
    }
}

function collect(source: ReadonlyMap<string, ReadonlySet<string>>): Record<string, readonly string[]> {
    return Object.fromEntries([...source.entries()].map(([taskId, ids]) => [taskId, [...ids]] as const));
}

export function isEventVerified(snapshot: ProvenanceSnapshot, taskId: string, eventId: string): boolean {
    return (snapshot.eventIdsByTask[taskId] ?? []).includes(eventId);
}

export function isTurnVerified(snapshot: ProvenanceSnapshot, taskId: string, turnId: string): boolean {
    return (snapshot.turnIdsByTask[taskId] ?? []).includes(turnId);
}

export function isEventVerifiedAnyTask(snapshot: ProvenanceSnapshot, eventId: string): boolean {
    return Object.values(snapshot.eventIdsByTask).some((ids) => ids.includes(eventId));
}

export function isRuleVerified(snapshot: ProvenanceSnapshot, ruleId: string): boolean {
    return snapshot.ruleIds.includes(ruleId);
}

export function verifiedRecipeRev(snapshot: ProvenanceSnapshot, recipeId: string): number | undefined {
    return snapshot.recipeRevs[recipeId];
}
