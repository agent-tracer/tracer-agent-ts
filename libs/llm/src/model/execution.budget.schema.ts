import { z } from "zod";
import { readContractJson } from "~llm/support/contract.js";

const reservationEntrySchema = z.object({
    turns: z.number().int().min(0),
    budgetShare: z.number().min(0).max(1),
    reason: z.string().min(1),
});

/** 검증에 걸린 산출을 다시 받는 횟수는 이 단계에만 있으므로 그 몫의 모양을 따로 갖는다. */
const repairReservationSchema = reservationEntrySchema.extend({
    attempts: z.number().int().min(0),
});

const RESERVATION_STEPS = ["repair", "survey", "synthesisFloor"] as const;

const reservationSchema = z.object({
    meaning: z.string().min(1),
    order: z.array(z.enum(RESERVATION_STEPS)).length(RESERVATION_STEPS.length),
    repair: repairReservationSchema,
    survey: reservationEntrySchema,
    synthesisFloor: reservationEntrySchema,
});

const wallClockSchema = z.object({
    meaning: z.string().min(1),
    survey: z.number().gt(0).max(1),
    probe: z.number().gt(0).max(1),
    synthesis: z.number().gt(0).max(1),
    probeMinFraction: z.object({ value: z.number().gt(0).max(1), reason: z.string().min(1) }),
});

const pricingSchema = z.object({
    meaning: z.string().min(1),
    model: z.object({ value: z.enum(["actual", "requested"]), reason: z.string().min(1) }),
    onUnpricedModel: z.object({
        value: z.enum(["fail", "ignore"]),
        reason: z.string().min(1),
        subtype: z.string().min(1),
    }),
});

const pacingSchema = z.object({
    meaning: z.string().min(1),
    unit: z.string().min(1),
    progressNotice: z.object({
        template: z.string().min(1),
        when: z.string().min(1),
        placeholders: z.array(z.string().min(1)).nonempty(),
        reason: z.string().min(1),
    }),
    landingReserve: z.object({
        calls: z.number().int().positive(),
        meaning: z.string().min(1),
        rule: z.string().min(1),
        reason: z.string().min(1),
        providerBackstop: z.number().positive(),
        providerBackstopMeaning: z.string().min(1),
        providerBackstopReason: z.string().min(1),
    }),
    landingDirective: z.object({
        when: z.string().min(1),
        structured: z.string().min(1),
        freeText: z.string().min(1),
        reason: z.string().min(1),
    }),
});

/** 실행기가 같은 질의를 다시 부르는 두 층이며 세는 것이 다르므로 칸을 나눠 갖는다. */
const runnerRetrySchema = z.object({
    transient: z.object({
        attempts: z.number().int().min(0),
        initialDelayMs: z.number().int().min(0),
        backoffFactor: z.number().min(1),
        jitter: z.boolean(),
    }),
    schemaViolation: z.object({
        attempts: z.number().int().min(0),
        directive: z.string().min(1),
    }),
});

const executionBudgetSchema = z.object({
    runnerRetry: runnerRetrySchema,
    meaning: z.string().min(1),
    reservation: reservationSchema,
    pacing: pacingSchema,
    wallClock: wallClockSchema,
    pricing: pricingSchema,
});

export type ExecutionBudgetPacing = z.infer<typeof pacingSchema>;
export type ExecutionBudgetWallClock = z.infer<typeof wallClockSchema>;
export type ExecutionBudgetPricing = z.infer<typeof pricingSchema>;
export type ExecutionBudgetReservationEntry = z.infer<typeof reservationEntrySchema>;
export type ExecutionBudgetReservation = z.infer<typeof reservationSchema>;
export type ExecutionBudgetContract = z.infer<typeof executionBudgetSchema>;

let cached: ExecutionBudgetContract | null = null;

/** 예약 몫과 뗄 순서의 정본을 계약에서 읽어 검증한 결과를 돌려준다. */
export function loadExecutionBudgetContract(): ExecutionBudgetContract {
    if (cached === null) {
        const parsed = executionBudgetSchema.parse(
            readContractJson<unknown>("agent/shared/execution.budget.json"),
        );
        assertReservationOrder(parsed.reservation.order);
        cached = parsed;
    }
    return cached;
}

// 뗄 순서가 이 값과 다르면 같은 비율이 다른 액수가 되어 recipe.agent.adapter.ts의 예약 호출 순서와 어긋난다.
function assertReservationOrder(order: readonly (typeof RESERVATION_STEPS)[number][]): void {
    const expected = RESERVATION_STEPS.join(",");
    const actual = order.join(",");
    if (actual !== expected) {
        throw new Error(`execution.budget.json: reservation.order must be [${expected}], got [${actual}]`);
    }
}
