/** 잡 상태 변화를 사용자에게 알린다. */
export interface JobNotificationPort {
    jobUpdated(userId: string, payload: Record<string, unknown>): Promise<void>;
}

/** 알림 하나를 사용자 범위로 실어 보내는 자리이며 무엇으로 보내는지는 조립이 정한다. */
export type NotificationPublish = (userId: string, payload: Record<string, unknown>) => Promise<void>;
