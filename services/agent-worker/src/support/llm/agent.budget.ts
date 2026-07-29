/** 실행 하나가 여러 호출에 걸쳐 지키는 총 예산이다. */
export interface AgentBudgetTotals {
    readonly maxBudgetUsd: number | undefined;
    readonly maxTurns: number;
}

/** 한 번의 호출에 떼어 준 몫이며 그대로 공급자 실행기에 넘긴다. */
export interface AgentBudgetLease {
    readonly maxBudgetUsd: number | undefined;
    readonly maxTurns: number;
}

/** 한 번의 호출이 실제로 쓴 양이며 공급자가 보고하지 않으면 null이다. */
export interface AgentBudgetSpend {
    readonly costUsd: number | null;
    readonly numTurns: number | null;
}

interface ReservedBudget {
    readonly turns: number;
    readonly usd: number | undefined;
}

const EMPTY_RESERVED_BUDGET: ReservedBudget = { turns: 0, usd: 0 };

/** 실행 하나의 잔여 예산을 쥐고 호출마다 몫을 떼어 주며 실제 지출로 잔량을 줄인다. */
export class ExecutionBudget {
    private remainingBudgetUsd: number | undefined;
    private remainingTurns: number;
    private readonly reservations = new WeakMap<AgentBudgetLease, ReservedBudget>();
    private readonly settled = new WeakSet<AgentBudgetLease>();

    constructor(totals: AgentBudgetTotals) {
        this.remainingBudgetUsd = totals.maxBudgetUsd;
        this.remainingTurns = totals.maxTurns;
    }

    /** 요청한 턴과 비용 잔량을 모두 감당할 수 있는지 알린다. */
    hasRemainingCapacity(requiredTurns = 1): boolean {
        return (
            this.remainingTurns >= requiredTurns
            && (this.remainingBudgetUsd === undefined || this.remainingBudgetUsd > 0)
        );
    }

    /** 잔량의 share 몫을 떼어 주며 잔량이 0이면 0인 채로 드러낸다. */
    lease(share: number): AgentBudgetLease {
        if (!(share > 0) || share > 1) throw new RangeError(`share must be in (0, 1], got ${share}`);
        return {
            maxTurns: Math.floor(this.remainingTurns * share),
            maxBudgetUsd:
                this.remainingBudgetUsd === undefined ? undefined : this.remainingBudgetUsd * share,
        };
    }

    /** 몫을 lease보다 먼저 잔량에서 떼어내 별도로 쥐므로 그 뒤의 lease가 이 몫을 침범하지 못한다. */
    reserve(turns: number, budgetShare = 0): AgentBudgetLease {
        if (turns < 0) throw new RangeError(`turns must be >= 0, got ${turns}`);
        if (budgetShare < 0 || budgetShare > 1) {
            throw new RangeError(`budgetShare must be in [0, 1], got ${budgetShare}`);
        }
        const grantedTurns = Math.min(turns, this.remainingTurns);
        this.remainingTurns -= grantedTurns;

        let grantedUsd: number | undefined;
        if (this.remainingBudgetUsd !== undefined) {
            grantedUsd = this.remainingBudgetUsd * budgetShare;
            this.remainingBudgetUsd -= grantedUsd;
        }

        const lease = { maxTurns: grantedTurns, maxBudgetUsd: grantedUsd };
        this.reservations.set(lease, { turns: grantedTurns, usd: grantedUsd });
        return lease;
    }

    /** 잔량의 share 몫을 요청 비율로 배분하며 내림한 나머지는 요청이 큰 항목부터 한 턴씩 돌려준다. */
    leaseMany(requestedTurns: readonly number[], share: number): AgentBudgetLease[] {
        if (!(share > 0) || share > 1) throw new RangeError(`share must be in (0, 1], got ${share}`);
        if (requestedTurns.length === 0) return [];

        const availableTurns = Math.floor(this.remainingTurns * share);
        const grantedTurns = clampTurnsWithoutLeak(requestedTurns, availableTurns);
        const availableUsd =
            this.remainingBudgetUsd === undefined ? undefined : this.remainingBudgetUsd * share;
        const turnsSum = grantedTurns.reduce((sum, turns) => sum + turns, 0);

        return grantedTurns.map((turns) => ({
            maxTurns: turns,
            maxBudgetUsd:
                availableUsd === undefined
                    ? undefined
                    : turnsSum === 0
                        ? 0
                        : (availableUsd * turns) / turnsSum,
        }));
    }

    /** 떼어 준 몫에 실제 지출을 대조해 잔량을 줄이되 실제 값을 모르면 몫 전부를 쓴 것으로 본다. */
    settle(lease: AgentBudgetLease, spend: AgentBudgetSpend): void {
        if (this.settled.has(lease)) throw new Error("budget lease is already settled");
        this.settled.add(lease);

        const turnsUsed = spend.numTurns ?? lease.maxTurns;
        const reserved = this.reservations.get(lease) ?? EMPTY_RESERVED_BUDGET;
        this.remainingTurns = Math.max(0, this.remainingTurns + reserved.turns - turnsUsed);

        if (this.remainingBudgetUsd === undefined) return;
        const usdUsed = spend.costUsd ?? lease.maxBudgetUsd ?? 0;
        this.remainingBudgetUsd = Math.max(0, this.remainingBudgetUsd + (reserved.usd ?? 0) - usdUsed);
    }

    /** 예약한 바닥과 남은 잔량의 호출 몫을 하나로 묶어도 정산 때 예약분을 다시 차감하지 않는다. */
    combine(leases: readonly AgentBudgetLease[]): AgentBudgetLease {
        const combined = combineLeases(leases);
        const reserved = leases.reduce<ReservedBudget>(
            (sum, lease) => {
                const current = this.reservations.get(lease) ?? EMPTY_RESERVED_BUDGET;
                return {
                    turns: sum.turns + current.turns,
                    usd:
                        sum.usd === undefined || current.usd === undefined
                            ? undefined
                            : sum.usd + current.usd,
                };
            },
            { turns: 0, usd: 0 },
        );
        if (reserved.turns > 0 || reserved.usd !== 0) this.reservations.set(combined, reserved);
        return combined;
    }
}

/** 예약한 몫과 잔량에서 뜬 몫을 하나로 더해 떼어 둔 바닥에 나머지를 얹어 준다. */
export function combineLeases(leases: readonly AgentBudgetLease[]): AgentBudgetLease {
    return {
        maxTurns: leases.reduce((sum, lease) => sum + lease.maxTurns, 0),
        maxBudgetUsd: leases.some((lease) => lease.maxBudgetUsd === undefined)
            ? undefined
            : leases.reduce((sum, lease) => sum + (lease.maxBudgetUsd ?? 0), 0),
    };
}

function clampTurnsWithoutLeak(requested: readonly number[], available: number): number[] {
    const total = requested.reduce((sum, value) => sum + value, 0);
    if (total <= available) return [...requested];

    const floor = requested.length;
    const rankDescending = requested.map((_, index) => index).sort((a, b) => requested[b]! - requested[a]!);

    // 항목 수가 배분 가능 턴보다 많으면 최소 1턴씩도 다 줄 수 없으므로 많이 요구한 순서로만 남긴다.
    if (floor > available) {
        const granted = new Array<number>(floor).fill(0);
        for (const index of rankDescending.slice(0, available)) granted[index] = 1;
        return granted;
    }

    const spare = Math.max(available - floor, 0);
    const over = total - floor;
    const granted = requested.map((value) => 1 + (over > 0 ? Math.floor(((value - 1) * spare) / over) : 0));

    const remainder = Math.max(available - granted.reduce((sum, value) => sum + value, 0), 0);
    for (const index of rankDescending.slice(0, remainder)) granted[index] = (granted[index] ?? 0) + 1;
    return granted;
}
