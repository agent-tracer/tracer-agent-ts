import { readContractJson } from "~agent-api/support/contract.js";

/** 자격 판정이 보는 앵커의 모양이며 창구가 무엇을 읽어 오는지는 알지 않는다. */
export interface ScanAnchorFacts {
    readonly origin: string | null;
    readonly root: boolean;
    readonly status: string | null;
}

/** 스캔을 부른 표면이며 요청이 말하지 않으면 dashboard 로 본다. */
export const SCAN_TRIGGER = { dashboard: "dashboard", session: "session" } as const;

export type ScanTrigger = (typeof SCAN_TRIGGER)[keyof typeof SCAN_TRIGGER];

type Requirement = "origin" | "root" | "status";

interface ScanAnchorContract {
    readonly anchor: {
        readonly requires: {
            readonly origin: { readonly excludes: readonly string[] };
            readonly root: { readonly value: boolean };
            readonly status: { readonly oneOf: readonly string[] };
        };
        readonly decidedAt: { readonly value: string };
        readonly byTrigger: Readonly<Record<ScanTrigger, readonly Requirement[]>>;
    };
}

const DECLARED = readContractJson<ScanAnchorContract>("agent/recipe-scan/agent.json").anchor;

/** 자격을 접수가 판정하는지 워커가 판정하는지이며 계약이 그 자리를 정한다. */
export const SCAN_ANCHOR_DECIDED_AT = DECLARED.decidedAt.value;

/** 그 표면이 요구하는 조건을 앵커가 모두 만족하는지 판정한다. */
export function scanAnchorEligible(anchor: ScanAnchorFacts, trigger: ScanTrigger): boolean {
    return DECLARED.byTrigger[trigger].every((requirement) => satisfies(anchor, requirement));
}

function satisfies(anchor: ScanAnchorFacts, requirement: Requirement): boolean {
    if (requirement === "origin") {
        return anchor.origin === null || !DECLARED.requires.origin.excludes.includes(anchor.origin);
    }
    if (requirement === "root") return anchor.root === DECLARED.requires.root.value;
    return anchor.status !== null && DECLARED.requires.status.oneOf.includes(anchor.status);
}
