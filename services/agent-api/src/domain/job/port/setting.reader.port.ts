export const JOB_SETTING_READER = Symbol("JobSettingReader");

/** 잡 실행에 필요한 앱 설정 값을 scope와 key로 읽는 포트다. */
export interface JobSettingReaderPort {
    findByScopeAndKey(scope: string, key: string): Promise<string | null>;
}
