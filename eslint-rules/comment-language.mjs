// 영어 산문과 em-dash 부연과 외부 링크와 결정 문서 인용과 두 문장 이상을 잡는다.

const DIRECTIVE = /^\s*(eslint-|@ts-|ts-|prettier-|c8 |istanbul |globals?\b|<reference|region|endregion)/;
const DIVIDER = /^[\s\-=*─━#/.|+]+$/;
const LICENSE = /^\s*(Copyright|SPDX-|License|@license)/i;
const DECISION_REFERENCE = /\bADR-?\s?\d/i;
const EXTERNAL_LINK = /https?:\/\//;
const ENGLISH_WORD = /[A-Za-z]{2,}/g;
const KOREAN = /[가-힣]/;
// 소수점과 코드 식별자를 빼려고 한글로 끝나는 마침표만 센다.
const KOREAN_SENTENCE_END = /[가-힣][)\]"'`»】]*\.(?=\s|$)/g;
const MAX_SENTENCES = 1;

// 어간에 어미가 붙어 형태가 바뀌므로 은유와 구어를 실제로 나타나는 표면형으로 적는다.
const FIGURATIVE = [
  [/걷어/, "제거한다"], [/가른|가르는|가르고/, "구분한다"],
  [/캔다|캐는|캐고|캐지|캐라|캐낸|캘/, "수집한다"], [/잠근|잠그는/, "고정한다"],
  [/죽인|죽이|죽어 있/, "중단한다"], [/이긴/, "우선한다"],
  [/(?<![가-힣])(?:돈다|도는|도므로)|(?<!되)돌[린리]|(?<!되)돌려(?![주준줄줘줍받보])|돌았/, "실행한다"],
  [/집는|(?<!뒤)집히|집어/, "가져간다"], [/흘린|흘리|흘려/, "전송한다"],
  [/붙는/, "연결된다"], [/바닥나|바닥난/, "소진된다"], [/혼자/, "단독으로"],
  [/태우|태운|태울|태워/, "실행한다"], [/쥐고/, "가지고"],
  [/무너지|무너진|무너져|무너졌/, "실패한다"], [/착지/, "종료한다"], [/강등/, "낮춘다"],
  [/열어보|열어본|열어볼|열어봤/, "조회한다"], [/훑는|훑은|훑고|훑어/, "조회한다"],
  [/깨우고|깨우는|깨운|깨웠|깨움/, "알린다"], [/못박|못 박/, "고정한다"],
  [/완주/, "끝까지 실행한다"], [/견준|견주고|견주는|견주게|견줄|견줘/, "비교한다"],
  [/굶기|굶주/, "막는다"], [/새긴|새기|새겨|새겼/, "기록한다"],
  [/(?<![가-힣])심[는은어었]/, "기록한다"], [/먹도록|먹었|먹는다/, "쓴다"],
  [/빚는|빚은|빚어/, "만든다"], [/팔지|팔고|파낸/, "조사한다"],
  [/편다|펴 보|펴지|펼친/, "정리한다"], [/(?<!맞)물린다|물려(?![받준])/, "넘긴다"],
  [/노릇/, "역할을 한다"], [/멋대로/, "근거 없이"], [/되레/, "오히려"], [/영영/, "끝내"],
  [/그러듯/, "실제 동작과 같이"], [/감당/, "처리한다"], [/새면/, "나간다"],
];
const MIN_ENGLISH_WORDS = 4;

const HANGUL_BASE = 0xac00;
const FINAL_COUNT = 28;
// 어간의 받침에 맞지 않는 어미와 조사는 문장을 성립시키지 못한다.
const VERB_ENDING = /([가-힣])(는다|은다)(?![가-힣])/g;
const OBJECT_PARTICLE = /([가-힣])를(?![가-힣])/g;

const hasFinal = (syllable) => (syllable.codePointAt(0) - HANGUL_BASE) % FINAL_COUNT !== 0;

/** 은유가 실제로 나타난 표면형과 대신 쓸 동사를 내며 없으면 null 이다. */
export function findFigurative(text) {
  for (const [pattern, plain] of FIGURATIVE) {
    const found = text.match(pattern);
    if (found) return { surface: found[0], plain };
  }
  return null;
}

/** 어간의 받침이 뒤에 온 어미나 조사와 맞지 않는 첫 자리를 낸다. */
export function malformedKorean(text) {
  for (const [surface, stem, ending] of text.matchAll(VERB_ENDING)) {
    if (hasFinal(stem) === (ending === "은다")) {
      return `어간의 받침에 맞지 않는 어미다: ${surface}`;
    }
  }
  for (const [surface, stem] of text.matchAll(OBJECT_PARTICLE)) {
    if (hasFinal(stem)) return `받침 있는 말 뒤의 목적격 조사는 을이다: ${surface}`;
  }
  return null;
}

export const commentLanguage = {
  meta: { type: "suggestion", schema: [] },
  create(context) {
    const source = context.sourceCode;

    const bodyOf = (comment) =>
      comment.value
        .split("\n")
        .map((line) => line.replace(/^\s*\*?\s?/, ""))
        .join("\n")
        .trim();

    // 잇달아 붙은 줄 주석은 한 서술이므로 묶어서 문장 수를 센다.
    function blocksOf(comments) {
      const blocks = [];
      let run = [];
      const flush = () => {
        if (run.length > 0) blocks.push(run);
        run = [];
      };
      for (const comment of comments) {
        if (comment.type !== "Line") {
          flush();
          blocks.push([comment]);
          continue;
        }
        const previous = run.at(-1);
        if (previous && comment.loc.start.line === previous.loc.end.line + 1) run.push(comment);
        else {
          flush();
          run = [comment];
        }
      }
      flush();
      return blocks;
    }

    const skippable = (text) =>
      text.length === 0 || DIRECTIVE.test(text) || DIVIDER.test(text) || LICENSE.test(text);

    return {
      Program() {
        // 셔뱅은 주석 노드로 오지만 산문이 아니다.
        const comments = source
          .getAllComments()
          .filter((comment) => comment.type === "Line" || comment.type === "Block");
        for (const comment of comments) {
          const text = bodyOf(comment);
          if (skippable(text)) continue;
          if (DECISION_REFERENCE.test(text)) {
            context.report({ node: comment, message: "주석에 결정 문서 번호를 인용하지 않는다" });
            continue;
          }
          const figurative = findFigurative(text);
          if (figurative) {
            context.report({
              node: comment,
              message: `은유와 구어 대신 코드가 하는 일을 적는다: ${figurative.surface} → ${figurative.plain}`,
            });
          }

          const malformed = malformedKorean(text);
          if (malformed) context.report({ node: comment, message: malformed });

          if (EXTERNAL_LINK.test(text)) {
            context.report({ node: comment, message: "주석에 외부 링크를 달지 않는다" });
            continue;
          }
          if (text.includes("—")) {
            context.report({ node: comment, message: "em-dash 부연을 쓰지 않는다. 마침표로 끊는다" });
            continue;
          }
          if (KOREAN.test(text)) continue;
          if ((text.match(ENGLISH_WORD) ?? []).length >= MIN_ENGLISH_WORDS) {
            context.report({ node: comment, message: "주석은 한글로 쓴다" });
          }
        }

        // 줄 주석과 JSDoc을 나란히 달면 어느 쪽이 계약인지 흐려지므로 한 선언에 주석은 한 벌만 둔다.
        for (let index = 1; index < comments.length; index += 1) {
          const previous = comments[index - 1];
          const current = comments[index];
          if (current.type !== "Block" || !current.value.startsWith("*")) continue;
          if (previous.type !== "Line") continue;
          if (current.loc.start.line !== previous.loc.end.line + 1) continue;
          if (skippable(bodyOf(previous))) continue;
          context.report({
            node: previous,
            message: "한 선언에 주석을 두 벌 달지 않는다. 줄 주석을 지우거나 JSDoc 한 문장에 합친다",
          });
        }

        for (const block of blocksOf(comments)) {
          const text = block.map(bodyOf).join(" ").trim();
          if (skippable(text) || !KOREAN.test(text)) continue;
          const sentences = (text.match(KOREAN_SENTENCE_END) ?? []).length;
          if (sentences > MAX_SENTENCES) {
            context.report({
              node: block[0],
              message: `주석은 한 문장으로 쓴다. 지금 ${sentences}문장이다. 동작은 이름과 타입과 테스트가 소유한다`,
            });
          }
        }
      },
    };
  },
};
