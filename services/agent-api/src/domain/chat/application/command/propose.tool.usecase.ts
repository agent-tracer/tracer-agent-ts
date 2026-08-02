import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { logInfo } from "@tracer-agent/platform";
import { ChatPendingTool } from "~agent-api/domain/chat/model/chat.pending.tool.model.js";
import {
    CHAT_CONFIRM_TOOLS,
    CHAT_TOOL_CONTRACT,
    parseChatToolArgs,
} from "~agent-api/domain/chat/model/chat.tool.schema.js";
import {
    CHAT_EXECUTION_UPDATE_PUBLISHER,
    type ChatExecutionUpdatePublisherPort,
} from "~agent-api/domain/chat/port/chat.execution.update.port.js";
import { CHAT_ID_GENERATOR, type ChatIdGeneratorPort } from "~agent-api/domain/chat/port/chat.id.generator.port.js";
import {
    CHAT_EXECUTION_REPOSITORY,
    CHAT_PENDING_TOOL_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatExecutionRepositoryPort,
    type ChatPendingToolRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~agent-api/domain/chat/port/chat.repository.port.js";
import { CHAT_CLOCK, type ClockPort } from "~agent-api/domain/chat/port/clock.port.js";

const CONFIRMABLE_TOOLS = new Set<string>(CHAT_CONFIRM_TOOLS);

export interface ProposeToolInput {
    readonly userId: string;
    readonly threadId: string;
    readonly toolName: string;
    readonly args: Record<string, unknown>;
}

/** 모델이 도구 결과로 그대로 읽는 확인 대기 결과이며, 필드 이름과 순서는 도구 계약이 소유한다. */
export interface ProposeToolResult {
    readonly confirmationId: string;
    readonly toolName: string;
    readonly status: string;
    readonly summary: string;
    readonly note: string;
}

/** 쓰기 도구 호출 하나를 실행하지 않고 확인 대기 행으로 세우며, 두 구현체가 이 한 경로로만 대기 행을 만든다. */
@Injectable()
export class ProposeToolUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_PENDING_TOOL_REPOSITORY)
        private readonly pendingTools: ChatPendingToolRepositoryPort,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
        @Inject(CHAT_ID_GENERATOR)
        private readonly ids: ChatIdGeneratorPort,
        @Inject(CHAT_EXECUTION_REPOSITORY)
        private readonly executions: ChatExecutionRepositoryPort,
        @Inject(CHAT_EXECUTION_UPDATE_PUBLISHER)
        private readonly events: ChatExecutionUpdatePublisherPort,
    ) {}

    async execute(input: ProposeToolInput): Promise<ProposeToolResult> {
        if (!CONFIRMABLE_TOOLS.has(input.toolName)) {
            throw new BadRequestException(`${input.toolName} is not a confirmable tool`);
        }
        const thread = await this.threads.findById(input.threadId);
        // 남의 스레드에는 대기 행을 세울 수 없고 존재 자체도 알리지 않는다.
        if (thread === null || !thread.isOwnedBy(input.userId)) throw new NotFoundException("Thread not found");

        const args = this.parseArgs(input.toolName, input.args);
        // 이 턴의 어시스턴트 메시지는 아직 적재 전이라 messageId는 확정할 수 없어 null로 둔다.
        const pending = ChatPendingTool.create({
            id: this.ids.next(),
            threadId: input.threadId,
            messageId: null,
            toolName: input.toolName,
            args,
            now: this.clock.now(),
        });
        await this.pendingTools.create(pending);
        await this.announce(input.threadId);
        logInfo({
            msg: "chat.tool.proposed",
            threadId: input.threadId,
            userId: input.userId,
            confirmationId: pending.id,
            toolName: pending.toolName,
        });
        return {
            confirmationId: pending.id,
            toolName: pending.toolName,
            status: pending.status,
            summary: summarizeMutation(pending.toolName, pending.args),
            note: CHAT_TOOL_CONTRACT.proposalNote,
        };
    }

    private parseArgs(toolName: string, raw: Record<string, unknown>): Record<string, unknown> {
        try {
            return parseChatToolArgs(toolName, raw);
        } catch {
            throw new BadRequestException(`${toolName} arguments are invalid`);
        }
    }

    /** 확인 대기는 스레드 것이므로 지금 열려 있는 실행 채널에 실어 다른 탭과 replica가 새 대기 행을 본다. */
    private async announce(threadId: string): Promise<void> {
        const active = await this.executions.findLatestActiveByThread(threadId);
        if (active !== null) this.events.publish(active.id);
    }
}

/** 사용자가 무엇을 승인하는지 한눈에 읽도록 인자를 한 줄로 줄인다. */
function summarizeMutation(toolName: string, args: Record<string, unknown>): string {
    const parts = Object.entries(args).map(([key, value]) => `${key}=${formatValue(value)}`);
    return parts.length > 0 ? `${toolName}(${parts.join(", ")})` : toolName;
}

function formatValue(value: unknown): string {
    if (typeof value === "string") return value.length > 80 ? `${value.slice(0, 77)}...` : value;
    return JSON.stringify(value);
}
