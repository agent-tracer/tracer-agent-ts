/** OTel GenAI semantic conventions의 표준 속성 키이며 이 어휘의 리터럴은 여기 밖에 두지 않는다. */
export const SEMCONV_ATTR = {
    operationName: "gen_ai.operation.name",
    providerName: "gen_ai.provider.name",
    conversationId: "gen_ai.conversation.id",
    agentName: "gen_ai.agent.name",
    requestModel: "gen_ai.request.model",
    responseModel: "gen_ai.response.model",
    inputTokens: "gen_ai.usage.input_tokens",
    outputTokens: "gen_ai.usage.output_tokens",
    cacheReadInputTokens: "gen_ai.usage.cache_read.input_tokens",
    cacheCreationInputTokens: "gen_ai.usage.cache_creation.input_tokens",
    tokenType: "gen_ai.token.type",
    toolName: "gen_ai.tool.name",
    toolType: "gen_ai.tool.type",
    errorType: "error.type",
} as const;

/** OTel semconv에 대응이 없는 제품 고유 속성 키다. */
export const AGENT_TRACER_ATTR = {
    jobId: "agent_tracer.job.id",
    executionId: "agent_tracer.execution.id",
    attemptId: "agent_tracer.attempt.id",
    modelCallId: "agent_tracer.model_call.id",
    promptVersion: "agent_tracer.prompt.version",
    promptHash: "agent_tracer.prompt.hash",
    toolContractVersion: "agent_tracer.tool.contract.version",
    jobKind: "agent_tracer.job.kind",
    backend: "agent_tracer.backend",
    toolParametersFingerprint: "agent_tracer.tool.parameters.fingerprint",
    /** gen_ai.usage.input_tokens가 cache 토큰을 포함한 총량이라 과금 기준인 베이스 입력 토큰을 따로 싣는다. */
    billableBaseInputTokens: "agent_tracer.usage.billable_base_input_tokens",
} as const;

export const GEN_AI_OBSERVABILITY_METRIC = {
    clientTokenUsage: "gen_ai.client.token.usage",
    clientOperationDuration: "gen_ai.client.operation.duration",
    invokeAgentDuration: "gen_ai.invoke_agent.duration",
    executeToolDuration: "gen_ai.execute_tool.duration",
} as const;

export const GEN_AI_OPERATION = {
    invokeAgent: "invoke_agent",
    chat: "chat",
    executeTool: "execute_tool",
    plan: "plan",
} as const;

export type GenAiOperation = (typeof GEN_AI_OPERATION)[keyof typeof GEN_AI_OPERATION];

export const GEN_AI_PROVIDER = {
    anthropic: "anthropic",
} as const;

export type GenAiProvider = (typeof GEN_AI_PROVIDER)[keyof typeof GEN_AI_PROVIDER];

export const GEN_AI_TOKEN_TYPE = {
    input: "input",
    output: "output",
} as const;

export const GEN_AI_TOOL_TYPE = {
    function: "function",
    datastore: "datastore",
} as const;
