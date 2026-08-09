import { readContractJson } from "~agent-api/support/contract.js";

interface LedgerEventsDeclaration {
    readonly name: string;
    readonly consumerGroups: { readonly agentProjector: string };
}

const declared = readContractJson<{ readonly ledgerEvents: LedgerEventsDeclaration }>("wire/topics.json")
    .ledgerEvents;

/** 추적이 소유한 사건 원장의 변경 스트림이며 이 축은 독자일 뿐 발행자가 아니다. */
export const LEDGER_EVENTS_TOPIC = declared.name;

/** 추적 프로젝터와 그룹을 나누지 않으면 한쪽이 읽은 메시지를 다른 쪽이 받지 못한다. */
export const LEDGER_EVENTS_CONSUMER_GROUP = declared.consumerGroups.agentProjector;
