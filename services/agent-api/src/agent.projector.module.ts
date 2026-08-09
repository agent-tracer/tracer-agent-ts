import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import type { DataSource } from "typeorm";
import { AGENT_DATA_SOURCE } from "~agent-api/config/agent.datasource.token.js";
import { recipeProjectorFeature } from "./recipe.feature.js";

/** 배경 작업만 실행하는 배포 단위의 유일한 배선 지점이며 HTTP 창구를 싣지 않는다. */
@Module({})
export class AgentProjectorModule {
    static forRoot(dataSource: DataSource): DynamicModule {
        return {
            module: AgentProjectorModule,
            providers: [
                { provide: AGENT_DATA_SOURCE, useValue: dataSource },
                ...recipeProjectorFeature.providers,
            ],
        };
    }
}
