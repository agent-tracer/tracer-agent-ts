import type { IClock } from "@tracer-agent/platform";

export const SETTING_CLOCK = Symbol("SettingClock");

/** 응용 계층이 지금을 읽는 유일한 통로다. */
export type ClockPort = IClock;
