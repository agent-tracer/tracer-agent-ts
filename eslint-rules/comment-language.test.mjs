import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { REGISTER_WORDS } from "../scripts/check-commit-msg.mjs";
import { FIGURATIVE, findFigurative, malformedKorean } from "./comment-language.mjs";

const surfacesOf = (table) => table.map(([pattern, plain]) => [pattern.source, plain]);

describe("주석 어휘 검사기", () => {
  it("은유의 활용형을 잡고 대신 쓸 동사를 알린다", () => {
    assert.equal(findFigurative("그래프가 도는 동안 노드를 센다")?.plain, "실행한다");
    assert.equal(findFigurative("실행기가 무너졌을 때 사유를 남긴다")?.plain, "실패한다");
    assert.equal(findFigurative("조율자가 근거를 직접 캐지 않는다")?.plain, "수집한다");
    assert.equal(findFigurative("두 구현체가 같은 바이트를 먹도록 적는다")?.plain, "쓴다");
  });

  it("제자리 낱말을 은유로 잡지 않는다", () => {
    assert.equal(findFigurative("갱신이 끊긴 실행을 대기 자리로 되돌린다"), null);
    assert.equal(findFigurative("연결 풀을 열고 부른 쪽에 돌려준다"), null);
    assert.equal(findFigurative("남의 스레드는 없는 것으로 돌려보낸다"), null);
    assert.equal(findFigurative("이 판정이 뒤집히면 산출 강제가 내려간다"), null);
    assert.equal(findFigurative("접은 문자열의 자리가 원문의 자리와 맞물린다"), null);
    assert.equal(findFigurative("핵심은 계약이 값을 소유한다는 사실이다"), null);
  });

  it("어간의 받침에 맞지 않는 어미를 잡는다", () => {
    assert.match(malformedKorean("이 스레드만 조회하는다"), /어미/);
    assert.match(malformedKorean("공급자의 판정만 받은다"), /어미/);
    assert.match(malformedKorean("바뀌는 값은 이 뒤에 연결되는다"), /어미/);
  });

  it("받침에 맞는 어미는 통과시킨다", () => {
    assert.equal(malformedKorean("이 스레드만 조회한다"), null);
    assert.equal(malformedKorean("노드 이름과 실행을 한 객체에 모은다"), null);
    assert.equal(malformedKorean("갱신이 끊긴 실행을 대기 자리로 되돌린다"), null);
  });

  it("커밋 메시지 검사기와 같은 표를 쓴다", () => {
    assert.deepEqual(surfacesOf(FIGURATIVE), surfacesOf(REGISTER_WORDS));
  });

  it("받침 있는 말 뒤의 목적격 조사를 잡는다", () => {
    assert.match(malformedKorean("맡아 둔 알림를 켠다"), /목적격 조사/);
    assert.equal(malformedKorean("맡아 둔 알림을 켠다"), null);
    assert.equal(malformedKorean("부를 수 있는 창구를 이름으로 고른다"), null);
  });
});
