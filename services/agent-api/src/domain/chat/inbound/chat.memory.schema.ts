import { z } from "zod";
import { contractArgMaxLength } from "@tracer-agent/llm";
import { CHAT_TOOL_CONTRACT } from "~agent-api/domain/chat/model/chat.tool.schema.js";

/** 사실 하나의 길이 상한이며 계약이 갖고 그 수는 도구 설명으로 모델에게도 간다. */
const FACT_MAX_CHARS = contractArgMaxLength(CHAT_TOOL_CONTRACT, "remember_fact", "content");

export const rememberFactBodySchema = z.object({
    content: z.string().trim().min(1).max(FACT_MAX_CHARS),
});

export type RememberFactBody = z.infer<typeof rememberFactBodySchema>;
