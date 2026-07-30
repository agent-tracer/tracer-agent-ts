import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROFILE_FRAGMENT_CHANNELS, promptFragmentChannel } from "./prompt.fragment.policy.js";
import { PROMPT_CHANNELS } from "./prompt.model.js";

interface FragmentRegistryContract {
    readonly identity: {
        readonly rejectedPrefixes: readonly string[];
        readonly uniqueness: Readonly<Record<string, readonly string[]>>;
    };
    readonly channels: Readonly<Record<string, string>>;
    readonly profileChannels: Readonly<Record<string, string>>;
    readonly drift: { readonly policy: string };
}

const registry = JSON.parse(
    readFileSync("contract/agent/shared/prompt.fragment.registry.json", "utf8"),
) as FragmentRegistryContract;

describe("프롬프트 조각 채널 정책", () => {
    it("계약이 선언한 채널 목록을 그대로 안다", () => {
        expect([...PROMPT_CHANNELS].sort()).toStrictEqual(Object.keys(registry.channels).sort());
    });

    it("profile 마다 계약이 정한 채널을 본다", () => {
        expect(PROFILE_FRAGMENT_CHANNELS).toStrictEqual(registry.profileChannels);
    });

    it.each(Object.entries(registry.profileChannels))("%s 프로파일이 %s 채널을 낸다", (profile, channel) => {
        expect(promptFragmentChannel(profile)).toBe(channel);
    });

    it("계약이 선언하지 않은 프로파일을 거절한다", () => {
        expect(() => promptFragmentChannel("unknown")).toThrow();
    });

    it("판이 어긋날 때 부팅을 끊기로 한 결정을 계약이 갖는다", () => {
        expect(registry.drift.policy).toBe("boot-fail");
    });

    it("조각의 유일성이 backend 를 포함한다", () => {
        expect(registry.identity.uniqueness["prompt_fragment_definitions"]).toContain("backend");
        expect(registry.identity.uniqueness["prompt_fragment_bindings"]).toContain("backend");
    });
});
