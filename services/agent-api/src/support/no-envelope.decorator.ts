import { SetMetadata } from "@nestjs/common";

export const NO_ENVELOPE_METADATA_KEY = "nestjs:no_envelope";

/** 응답 봉투 인터셉터가 이 표시가 붙은 핸들러의 응답은 감싸지 않고 그대로 내보낸다. */
export const NoEnvelope = (): MethodDecorator & ClassDecorator => SetMetadata(NO_ENVELOPE_METADATA_KEY, true);
