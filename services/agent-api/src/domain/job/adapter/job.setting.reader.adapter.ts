import { Inject, Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import { readAppSetting } from "~agent-api/config/app.setting.reader.js";
import type { JobSettingReaderPort } from "~agent-api/domain/job/port/setting.reader.port.js";

/** 잡 접수가 사용자 설정에서 모델 자격을 읽는 자리다. */
@Injectable()
export class JobSettingReaderAdapter implements JobSettingReaderPort {
    constructor(@Inject(AGENT_DATA_SOURCE) private readonly dataSource: DataSource) {}

    async findByScopeAndKey(scope: string, key: string): Promise<string | null> {
        return readAppSetting(this.dataSource, scope, key);
    }
}
