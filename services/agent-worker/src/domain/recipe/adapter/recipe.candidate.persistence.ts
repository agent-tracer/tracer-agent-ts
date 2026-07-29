import type { EntityManager, QueryDeepPartialEntity } from "typeorm";
import { SearchOutboxEntity, SEARCH_OUTBOX_TARGET } from "~agent-worker/config/ledger/tracer.entity.js";
import type { GeneratedRecipeCandidate } from "~agent-worker/domain/recipe/model/recipe.candidate.model.js";
import type { RecipeIdGeneratorPort } from "~agent-worker/domain/recipe/port/recipe.id.generator.port.js";
import type { OutputLanguage } from "~agent-worker/support/output.language.js";
import { RecipeEntity } from "./recipe.entity.js";

export interface PersistRecipeArgs {
    readonly userId: string;
    readonly language: OutputLanguage;
    readonly sourceJobId: string;
}

/** 조립된 후보를 candidate 상태로 저장하고 검색 색인 아웃박스에 큐잉한다. */
export async function persistRecipeCandidates(
    manager: EntityManager,
    args: PersistRecipeArgs,
    recipes: readonly GeneratedRecipeCandidate[],
    now: Date,
    ids: RecipeIdGeneratorPort,
): Promise<number> {
    let candidatesCreated = 0;
    for (const candidate of recipes) {
        const parentRecipeId = await resolveRevisionTarget(manager, args.userId, candidate);
        const recipe = RecipeEntity.candidate(
            {
                id: candidate.id,
                userId: args.userId,
                title: candidate.title,
                intent: candidate.intent,
                description: candidate.description,
                summaryMd: candidate.summaryMd,
                request: candidate.request,
                corrections: candidate.corrections,
                pitfalls: candidate.pitfalls,
                governingRules: candidate.governingRules,
                steps: candidate.steps,
                touchedFiles: candidate.touchedFiles,
                contributingSlices: candidate.contributingSlices,
                rationale: candidate.rationale,
                language: args.language,
                sourceJobId: args.sourceJobId,
                ...(parentRecipeId !== null ? { parentRecipeId } : {}),
            },
            now,
        );
        await manager
            .getRepository(RecipeEntity)
            .upsert(recipe as unknown as QueryDeepPartialEntity<RecipeEntity>, ["id"]);
        // 검색 인덱스는 데이터베이스 트랜잭션에 참여할 수 없어 아웃박스 행으로 남긴다.
        await manager.getRepository(SearchOutboxEntity).insert(
            SearchOutboxEntity.enqueue({
                id: ids.next(),
                userId: args.userId,
                target: SEARCH_OUTBOX_TARGET.recipe,
                targetId: recipe.id,
                now,
            }),
        );
        candidatesCreated += 1;
    }
    return candidatesCreated;
}

async function resolveRevisionTarget(
    manager: EntityManager,
    userId: string,
    candidate: GeneratedRecipeCandidate,
): Promise<string | null> {
    if (candidate.revisesRecipeId === undefined || candidate.revisesRecipeIdSeenRev === undefined) return null;
    const target = await manager.getRepository(RecipeEntity).findOneBy({ id: candidate.revisesRecipeId });
    if (target === null || target.userId !== userId) return null;
    return target.isRevisionStale(candidate.revisesRecipeIdSeenRev) ? null : target.id;
}
