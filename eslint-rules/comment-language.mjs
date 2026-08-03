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

// 커밋과 같은 어휘를 주석에도 강제하며 은유와 의인화 대신 코드가 하는 일을 적는다.
const FIGURATIVE = [
  ["걷어내", "제거한다"], ["가른", "구분한다"], ["캔다", "수집한다"], ["잠근", "고정한다"],
  ["죽인", "중단한다"], ["이긴", "우선한다"], ["돈다", "실행한다"], ["집는", "가져간다"],
  ["흘린", "전송한다"], ["붙는", "연결된다"], ["바닥나", "소진된다"], ["혼자", "단독으로"],
  ["태우", "실행한다"], ["쥐고", "가지고"], ["무너지", "실패한다"], ["착지", "종료한다"],
  ["강등", "낮춘다"], ["열어본", "조회한다"], ["훑는", "조회한다"], ["깨운", "알린다"],
  ["못박", "고정한다"], ["완주", "끝까지 실행한다"], ["견준", "비교한다"],
];
const MIN_ENGLISH_WORDS = 4;

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
          const figurative = FIGURATIVE.find(([word]) => text.includes(word));
          if (figurative) {
            context.report({
              node: comment,
              message: `은유와 구어 대신 코드가 하는 일을 적는다: ${figurative[0]} → ${figurative[1]}`,
            });
          }

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
