import type { PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import { logWarn } from "@tracer-agent/platform";

/** 이 서비스의 에이전트가 부를 일이 없는 빌트인이며 선언 자체를 지워 모델이 보지 못하게 한다. */
export const DENIED_BUILT_IN_TOOLS: readonly string[] = [
    "Bash",
    "BashOutput",
    "KillShell",
    "Write",
    "Edit",
    "NotebookEdit",
    "WebFetch",
    "WebSearch",
    "Agent",
    "Task",
    "Workflow",
];

/** 사전 승인한 도구만 실행하고 나머지는 프롬프트 없이 거절하는 모드다. */
export const LOCKED_PERMISSION_MODE: PermissionMode = "dontAsk";

/** 질의 하나가 모델에게 여는 도구 표면이다. */
export interface QueryPermissions {
    readonly allowedTools: readonly string[];
    readonly disallowedTools: readonly string[];
    readonly permissionMode: PermissionMode;
}

/** 호출자가 연 도구만 승인하고 그 밖의 빌트인은 선언에서 지운 도구 표면을 만든다. */
export function buildQueryPermissions(
    allowedTools: readonly string[],
    extraDenied: readonly string[] = [],
): QueryPermissions {
    const denied = new Set<string>([...DENIED_BUILT_IN_TOOLS, ...extraDenied]);
    // 호출자가 연 도구를 거절 목록이 다시 막으면 그 도구는 열린 적이 없는 것과 같다.
    for (const allowed of allowedTools) denied.delete(allowed);
    return {
        allowedTools: [...allowedTools],
        disallowedTools: [...denied],
        permissionMode: LOCKED_PERMISSION_MODE,
    };
}

/** 모델이 부르려다 거절당한 도구이며 이름만 남기고 인자는 남기지 않는다. */
export interface PermissionDenial {
    readonly tool_name: string;
}

/** 거절된 도구 호출을 남겨 모델이 도구 실패로 읽은 것이 실은 표면 밖이었음을 드러낸다. */
export function reportPermissionDenials(
    label: string,
    jobId: string | null,
    denials: readonly PermissionDenial[] | undefined,
): void {
    if (denials === undefined || denials.length === 0) return;
    logWarn({
        msg: "agent.query.denied",
        label,
        jobId,
        tools: [...new Set(denials.map((denial) => denial.tool_name))],
    });
}
