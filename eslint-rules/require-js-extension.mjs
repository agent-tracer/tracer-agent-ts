// TypeScript ESM이 요구하는 대로 로컬과 별칭 import를 .js 확장자로 끝맺게 한다.

const ASSET_EXTENSIONS = new Set([
  ".json", ".css", ".svg", ".png", ".webp", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2",
]);

export const requireJsExtension = {
  meta: { type: "problem", fixable: "code", schema: [] },
  create(context) {
    function check(source) {
      if (!source || source.type !== "Literal" || typeof source.value !== "string") return;
      const specifier = source.value;
      if (!specifier.startsWith(".") && !specifier.startsWith("~")) return;
      if (specifier.endsWith(".js")) return;
      if (ASSET_EXTENSIONS.has(specifier.slice(specifier.lastIndexOf(".")))) return;
      context.report({
        node: source,
        message: `로컬 import는 .js로 끝난다: "${specifier}.js"`,
        fix: (fixer) => fixer.replaceText(source, `"${specifier}.js"`),
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
