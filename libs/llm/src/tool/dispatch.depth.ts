/** 조율자가 배정 하나에 고르는 조사 깊이이며 몫의 수치는 계약이 갖는다. */
export const DISPATCH_DEPTHS = ["shallow", "normal", "deep"] as const;

export type DispatchDepth = (typeof DISPATCH_DEPTHS)[number];

/** 깊이마다의 몫을 계약 선언에서 읽으며 어휘가 어긋나면 거절한다. */
export function depthShares(
    declared: Readonly<Record<string, number>> | undefined,
    where: string,
): Readonly<Record<DispatchDepth, number>> {
    const shares: Partial<Record<DispatchDepth, number>> = {};
    for (const depth of DISPATCH_DEPTHS) {
        const share = declared?.[depth];
        if (typeof share !== "number") throw new Error(`contract-tool.depth-missing:${where}.${depth}`);
        shares[depth] = share;
    }
    return shares as Readonly<Record<DispatchDepth, number>>;
}
