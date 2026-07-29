import { z } from "zod";

/** 어느 구현체로 실행하든 대화 턴 하나가 돌려주는 구조화 출력이며 모양은 계약이 소유한다. */
export const chatTurnResultSchema = z.object({
    assistantText: z.string(),
    proposedWrites: z.array(
        z.object({
            confirmationId: z.string().trim().min(1),
            toolName: z.string().trim().min(1),
            args: z.record(z.unknown()),
        }),
    ),
});

export type ChatTurnResultPayload = z.infer<typeof chatTurnResultSchema>;
