import { AGENT_BACKEND } from "@tracer-agent/llm";
import { readContractJson, type AxisTemplateDeclaration } from "~agent-api/support/contract.js";

interface LedgerEventsDeclaration {
    readonly name: string;
    readonly consumerGroups: { readonly agentProjector: AxisTemplateDeclaration };
}

const declared = readContractJson<{ readonly ledgerEvents: LedgerEventsDeclaration }>("wire/topics.json")
    .ledgerEvents;

/** 추적이 소유한 사건 원장의 변경 스트림이며 이 축은 독자일 뿐 발행자가 아니다. */
export const LEDGER_EVENTS_TOPIC = declared.name;

/** 추적 프로젝터와도 상대 축과도 그룹을 나누려고 계약의 서식에 자기 축을 넣어 이름을 만든다. */
export const LEDGER_EVENTS_CONSUMER_GROUP = declared.consumerGroups.agentProjector.template.replace(
    declared.consumerGroups.agentProjector.placeholder,
    AGENT_BACKEND,
);
