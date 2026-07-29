// 테스트 이름은 한글 행위 문장이며 대상 이름을 쓰는 describe는 검사하지 않는다.

const KOREAN = /[가-힣]/;

export const koreanTestTitle = {
  meta: { type: "problem", schema: [] },
  create(context) {
    function titleOf(node) {
      const first = node.arguments[0];
      if (!first) return null;
      if (first.type === "Literal" && typeof first.value === "string") return first.value;
      if (first.type === "TemplateLiteral" && first.expressions.length === 0) {
        return first.quasis.map((quasi) => quasi.value.raw).join("");
      }
      return null;
    }

    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier") return;
        if (node.callee.name !== "it" && node.callee.name !== "test") return;
        const title = titleOf(node);
        if (title === null || KOREAN.test(title)) return;
        context.report({
          node: node.arguments[0],
          message: `테스트 이름은 한글 행위 문장으로 쓴다("…한다"): "${title}"`,
        });
      },
    };
  },
};
