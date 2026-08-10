import { AGENT_BACKEND } from "@tracer-agent/llm";
import { describe, expect, it } from "vitest";
import { readContractJson } from "~agent-api/support/contract.js";
import { LEDGER_EVENTS_CONSUMER_GROUP, LEDGER_EVENTS_TOPIC } from "./ledger.topic.const.js";

interface TopicsDeclaration {
    readonly ledgerEvents: {
        readonly name: string;
        readonly consumerGroups: {
            readonly agentProjector: {
                readonly template: string;
                readonly byAxis: Readonly<Record<string, string>>;
            };
        };
    };
}

const declared = readContractJson<TopicsDeclaration>("wire/topics.json").ledgerEvents;

describe("사건 스트림을 읽는 자리를 계약이 정한다", () => {
    it("읽는 토픽의 이름이 계약이 선언한 이름과 같다", () => {
        expect(LEDGER_EVENTS_TOPIC).toBe(declared.name);
    });

    it("소비자 그룹의 이름이 계약이 이 축에 적은 이름과 같다", () => {
        expect(LEDGER_EVENTS_CONSUMER_GROUP).toBe(declared.consumerGroups.agentProjector.byAxis[AGENT_BACKEND]);
    });

    it("소비자 그룹의 이름에 채우지 못한 자리표시자가 남지 않는다", () => {
        expect(LEDGER_EVENTS_CONSUMER_GROUP).not.toMatch(/[{}]/u);
    });

    it("두 축의 소비자 그룹이 서로 다른 이름을 갖는다", () => {
        const names = Object.values(declared.consumerGroups.agentProjector.byAxis);

        expect(new Set(names).size).toBe(names.length);
    });
});
