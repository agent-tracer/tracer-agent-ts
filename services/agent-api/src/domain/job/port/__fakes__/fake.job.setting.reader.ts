import type { JobSettingReaderPort } from "~agent-api/domain/job/port/setting.reader.port.js";

/** 설정 읽기 포트의 대역이며, 생성자로 넘긴 값을 scope와 key와 무관하게 그대로 되돌린다. */
export class FakeJobSettingReader implements JobSettingReaderPort {
    readonly requested: { readonly scope: string; readonly key: string }[] = [];

    constructor(private readonly value: string | null = null) {}

    findByScopeAndKey(scope: string, key: string): Promise<string | null> {
        this.requested.push({ scope, key });
        return Promise.resolve(this.value);
    }
}
