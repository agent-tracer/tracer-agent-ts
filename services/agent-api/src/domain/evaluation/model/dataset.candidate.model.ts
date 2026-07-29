export type DatasetCandidateReason = "failure" | "user-correction";

export interface DatasetCandidate {
    readonly executionId: string;
    readonly exampleId: string;
    readonly reason: DatasetCandidateReason;
    readonly agentName: string;
    input: Record<string, unknown>;
    readonly output: Record<string, unknown> | null;
    readonly score: number | null;
    readonly createdAt: string;
}
