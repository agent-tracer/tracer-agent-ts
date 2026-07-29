import type { ChatSettingReaderPort } from "~agent-api/domain/chat/port/setting.reader.port.js";

/** 설정 읽기 포트의 대역이며, 생성자로 넘긴 값을 scope와 key와 무관하게 그대로 되돌린다. */
export class FakeChatSettingReader implements ChatSettingReaderPort {
    calls = 0;
    readonly requested: { readonly scope: string; readonly key: string }[] = [];

    constructor(private readonly value: string | null = null) {}

    findByScopeAndKey(scope: string, key: string): Promise<string | null> {
        this.calls += 1;
        this.requested.push({ scope, key });
        return Promise.resolve(this.value);
    }
}
