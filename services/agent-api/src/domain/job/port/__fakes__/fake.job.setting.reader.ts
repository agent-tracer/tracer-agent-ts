import type { JobSettingReaderPort } from "~agent-api/domain/job/port/setting.reader.port.js";

/** 설정 읽기 포트의 대역이며, 키마다 정한 값이 없으면 생성자로 넘긴 값을 그대로 되돌린다. */
export class FakeJobSettingReader implements JobSettingReaderPort {
    readonly requested: { readonly scope: string; readonly key: string }[] = [];
    private readonly byKey = new Map<string, string | null>();

    constructor(private readonly value: string | null = null) {}

    /** 키 하나의 값을 정해 두며 정하지 않은 키는 생성자의 값을 그대로 쓴다. */
    set(key: string, value: string | null): this {
        this.byKey.set(key, value);
        return this;
    }

    findByScopeAndKey(scope: string, key: string): Promise<string | null> {
        this.requested.push({ scope, key });
        return Promise.resolve(this.byKey.has(key) ? this.byKey.get(key)! : this.value);
    }
}
