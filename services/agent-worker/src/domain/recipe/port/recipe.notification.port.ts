/** 잡 상태 변화를 사용자에게 알린다. */
export interface RecipeNotificationPort {
    jobUpdated(userId: string, payload: Record<string, unknown>): Promise<void>;
}
