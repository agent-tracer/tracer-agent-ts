export const CHAT_SETTING_READER = Symbol("ChatSettingReader");

/** 대화 턴 실행에 필요한 앱 설정 값을 scope와 key로 읽는 포트다. */
export interface ChatSettingReaderPort {
    findByScopeAndKey(scope: string, key: string): Promise<string | null>;
}
