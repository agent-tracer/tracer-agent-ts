import type { DataSource } from "typeorm";
import { readAppSetting } from "~agent-worker/config/app.setting.reader.js";
import type { ChatSettingReaderPort } from "~agent-worker/domain/chat/port/setting.reader.port.js";

/** 설정 표는 추적 서비스가 소유하므로 스키마를 선언하지 않고 값 한 칸만 읽는다. */
export class ChatSettingReaderAdapter implements ChatSettingReaderPort {
    constructor(private readonly dataSource: DataSource) {}

    findValue(scope: string, key: string): Promise<string | null> {
        return readAppSetting(this.dataSource, scope, key);
    }
}
