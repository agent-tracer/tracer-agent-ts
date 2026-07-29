// 두 단계 이상 거슬러 올라가는 상대 경로를 매니페스트가 소유한 별칭으로 치환한다.

import path from "node:path";

export const noDeepRelativeImport = {
  meta: {
    type: "problem",
    fixable: "code",
    schema: [{
      type: "object",
      properties: { aliases: { type: "object", additionalProperties: { type: "string" } } },
      additionalProperties: false,
    }],
  },
  create(context) {
    const aliases = Object.entries(context.options[0]?.aliases ?? {});
    const fileDir = path.dirname(context.filename);

    function toAlias(absolute) {
      for (const [alias, target] of aliases) {
        if (absolute.startsWith(target + path.sep)) return `${alias}${absolute.slice(target.length)}`;
        if (absolute === `${target}.js`) return `${alias}/index.js`;
        if (absolute === target) return alias;
      }
      return null;
    }

    function check(source) {
      if (!source || source.type !== "Literal" || typeof source.value !== "string") return;
      const specifier = source.value;
      if (!specifier.startsWith("../../")) return;
      const replacement = toAlias(path.resolve(fileDir, specifier));
      if (replacement === null) {
        context.report({
          node: source,
          message: `상대 경로가 너무 깊다: "${specifier}". 매니페스트에 별칭을 등록한다`,
        });
        return;
      }
      context.report({
        node: source,
        message: `별칭 "${replacement}"을 쓴다`,
        fix: (fixer) => fixer.replaceText(source, `"${replacement}"`),
      });
    }

    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
    };
  },
};
