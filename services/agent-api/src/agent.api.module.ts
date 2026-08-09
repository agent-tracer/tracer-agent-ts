import { Module } from "@nestjs/common";
import type { DynamicModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, DiscoveryModule } from "@nestjs/core";
import { TokenBucketLimiter } from "@tracer-agent/platform";
import type { DataSource } from "typeorm";
import { AGENT_DATA_SOURCE, AGENT_KAFKA } from "~agent-api/config/agent.datasource.token.js";
import { AccessLogInterceptor } from "~agent-api/config/access.log.interceptor.js";
import { AuthGuard } from "~agent-api/config/auth.guard.js";
import { GlobalExceptionFilter } from "~agent-api/config/exception.filter.js";
import type { KafkaClient } from "~agent-api/config/kafka.factory.js";
import { RateLimitGuard, resolveApiRateLimiter } from "~agent-api/config/rate.limit.guard.js";
import { ResponseEnvelopeInterceptor } from "~agent-api/config/response.envelope.interceptor.js";
import { CheckReadinessUseCase } from "~agent-api/domain/health/application/check.readiness.usecase.js";
import { ListServedSurfaceUseCase } from "~agent-api/domain/health/application/list.served.surface.usecase.js";
import { DataSourceReadinessProbeAdapter } from "~agent-api/domain/health/adapter/datasource.readiness.probe.adapter.js";
import { NestServedSurfaceAdapter } from "~agent-api/domain/health/adapter/nest.served.surface.adapter.js";
import { HealthController } from "~agent-api/domain/health/inbound/health.controller.js";
import { SurfaceController } from "~agent-api/domain/health/inbound/surface.controller.js";
import { READINESS_PROBE } from "~agent-api/domain/health/port/readiness.probe.port.js";
import { SERVED_SURFACE } from "~agent-api/domain/health/port/served.surface.port.js";
import { chatFeature } from "./chat.feature.js";
import { cleanupFeature } from "./cleanup.feature.js";
import { jobFeature } from "./job.feature.js";
import { recipeFeature } from "./recipe.feature.js";
import { settingsFeature } from "./settings.feature.js";

@Module({})
export class AgentApiModule {
    static forRoot(dataSource: DataSource, kafka: KafkaClient): DynamicModule {
        return {
            module: AgentApiModule,
            imports: [DiscoveryModule],
            controllers: [
                ...chatFeature.controllers,
                ...jobFeature.controllers,
                ...settingsFeature.controllers,
                ...recipeFeature.controllers,
                ...cleanupFeature.controllers,
                HealthController,
                SurfaceController,
            ],
            providers: [
                { provide: AGENT_DATA_SOURCE, useValue: dataSource },
                { provide: AGENT_KAFKA, useValue: kafka },
                ...chatFeature.providers,
                ...jobFeature.providers,
                ...settingsFeature.providers,
                ...recipeFeature.providers,
                ...cleanupFeature.providers,
                DataSourceReadinessProbeAdapter,
                { provide: READINESS_PROBE, useExisting: DataSourceReadinessProbeAdapter },
                CheckReadinessUseCase,
                NestServedSurfaceAdapter,
                { provide: SERVED_SURFACE, useExisting: NestServedSurfaceAdapter },
                ListServedSurfaceUseCase,
                { provide: TokenBucketLimiter, useFactory: resolveApiRateLimiter },
                // 인증이 먼저 신원을 확정해야 레이트리밋이 진짜 사용자 단위로 걸린다.
                { provide: APP_GUARD, useClass: AuthGuard },
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: APP_INTERCEPTOR, useClass: AccessLogInterceptor },
                { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
                { provide: APP_FILTER, useClass: GlobalExceptionFilter },
            ],
        };
    }
}
