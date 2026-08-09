import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { DataSource } from "typeorm";
import { describe, expect, it } from "vitest";
import type { INestApplicationContext } from "@nestjs/common";
import { EnsureRecipeIndexUseCase } from "~agent-api/domain/recipe/application/ensure.recipe.index.usecase.js";
import { SearchOutboxDrainUseCase } from "~agent-api/domain/recipe/application/search.outbox.drain.usecase.js";
import { AgentProjectorModule } from "./agent.projector.module.js";
import { RecipeProjection } from "./recipe.feature.js";
import { AgentApiModule } from "./agent.api.module.js";

/** 원장 연결의 대역이며 배선이 저장소를 만들 때 부르는 자리만 흉내 낸다. */
const dataSource = { getRepository: () => ({}) } as unknown as DataSource;

/** 기본값은 배선의 빈 자리를 프로세스 중단으로 알리므로 테스트가 볼 수 있게 예외로 바꾼다. */
function standUp(): Promise<INestApplicationContext> {
    return NestFactory.createApplicationContext(AgentProjectorModule.forRoot(dataSource), {
        logger: false,
        abortOnError: false,
    });
}

describe("배경 작업 배포 단위의 배선", () => {
    it("색인 세우기와 아웃박스 배출과 사건 투영을 모두 해결한다", async () => {
        const context = await standUp();

        try {
            expect([
                context.get(EnsureRecipeIndexUseCase) instanceof EnsureRecipeIndexUseCase,
                context.get(SearchOutboxDrainUseCase) instanceof SearchOutboxDrainUseCase,
                context.get(RecipeProjection) instanceof RecipeProjection,
            ]).toEqual([true, true, true]);
        } finally {
            await context.close();
        }
    });
});

describe("두 배포 단위의 책임 분리", () => {
    it("배경 작업 단위는 컨트롤러를 싣지 않는다", () => {
        expect(AgentProjectorModule.forRoot(dataSource).controllers).toBeUndefined();
    });

    it("창구 단위는 배경 작업을 배선하지 않는다", () => {
        const module = AgentApiModule.forRoot(dataSource, undefined as never);
        const provided = (module.providers ?? []).map((provider) =>
            typeof provider === "object" && "provide" in provider ? provider.provide : provider,
        );

        expect(provided.filter((token) => token === SearchOutboxDrainUseCase || token === RecipeProjection))
            .toEqual([]);
    });
});
