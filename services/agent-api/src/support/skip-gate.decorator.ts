import { SetMetadata } from "@nestjs/common";

export const SKIP_GATE_METADATA_KEY = "monitor:skip_gate";

/** 헬스 프로브와 실행 자격만으로 닿는 경로에서 인증과 레이트리밋 가드를 우회한다. */
export const SkipGate = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_GATE_METADATA_KEY, true);
