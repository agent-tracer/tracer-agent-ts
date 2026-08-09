/** 정리 제안 실행에 필요한 앱 설정을 scope와 key로 읽는 포트다. */
export interface CleanupSettingReaderPort {
    findValue(scope: string, key: string): Promise<string | null>;
}
