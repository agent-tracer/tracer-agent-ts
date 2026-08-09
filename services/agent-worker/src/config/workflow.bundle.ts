import { bundleWorkflowCode, type BundleOptions, type WorkflowBundleWithSourceMap } from "@temporalio/worker";

/** 이 서비스가 세우는 워크플로 번들의 진입점 전부다. */
export const WORKFLOW_ENTRIES = ["workflows", "chat.workflows"] as const;

export type WorkflowEntry = (typeof WORKFLOW_ENTRIES)[number];

/** 워크플로 번들의 진입점은 슬라이스를 전부 아는 조립 근원이므로 config가 아니라 src 뿌리에 있다. */
export function workflowEntryPath(entry: WorkflowEntry): string {
    return new URL(
        `../${entry}.${import.meta.url.endsWith(".ts") ? "ts" : "js"}`,
        import.meta.url,
    ).pathname;
}

/** 워크플로 번들러는 자체 리졸버를 써서 tsconfig 별칭을 모르므로 여기서 알려준다. */
export const workflowBundlerOptions = {
    webpackConfigHook: (config) => {
        config.resolve = {
            ...config.resolve,
            alias: {
                ...config.resolve?.alias,
                "~agent-worker": new URL("..", import.meta.url).pathname,
            },
        };
        return config;
    },
} satisfies Pick<BundleOptions, "webpackConfigHook">;

/** 워커가 기동할 때와 같은 설정으로 번들을 만들며 결정적 샌드박스에 실을 수 없는 모듈이 있으면 실패한다. */
export function bundleWorkflows(entry: WorkflowEntry): Promise<WorkflowBundleWithSourceMap> {
    return bundleWorkflowCode({
        workflowsPath: workflowEntryPath(entry),
        ...workflowBundlerOptions,
    });
}
