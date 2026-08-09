import type { DataSource } from "typeorm";
import { readAppSetting } from "~agent-worker/config/app.setting.reader.js";
import type { TitleSettingReaderPort } from "~agent-worker/domain/title/port/setting.reader.port.js";

/** 설정 한 칸을 읽는 자기 협력자이며 잡 원장의 트랜잭션 밖에서만 불려 연결을 하나만 쓴다. */
export class TitleSettingReaderAdapter implements TitleSettingReaderPort {
    constructor(private readonly dataSource: DataSource) {}

    findValue(scope: string, key: string): Promise<string | null> {
        return readAppSetting(this.dataSource, scope, key);
    }
}
