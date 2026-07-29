// TypeScript의 번들러 해석이 디렉터리 단축 표기를 풀지 않으므로 index를 명시하게 한다.

import fs from "node:fs";
import path from "node:path";

export const preferBarrelIndex = {
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

    function resolveWithoutExtension(specifier) {
      const bare = specifier.slice(0, -3);
      if (!specifier.startsWith("~")) return path.resolve(fileDir, bare);
      for (const [alias, target] of aliases) {
        if (bare === alias) return target;
        if (bare.startsWith(`${alias}/`)) return path.join(target, bare.slice(alias.length + 1));
      }
      return null;
    }

    const isFile = (candidate) => {
      try {
        return fs.statSync(candidate).isFile();
      } catch {
        return false;
      }
    };
    const hasIndex = (candidate) =>
      isFile(path.join(candidate, "index.ts")) || isFile(path.join(candidate, "index.tsx"));

    function check(source) {
      if (!source || source.type !== "Literal" || typeof source.value !== "string") return;
      const specifier = source.value;
      if (!specifier.endsWith(".js") || specifier.endsWith("/index.js")) return;
      if (!specifier.startsWith(".") && !specifier.startsWith("~")) return;
      const resolved = resolveWithoutExtension(specifier);
      if (resolved === null) return;
      if (isFile(`${resolved}.ts`) || isFile(`${resolved}.tsx`) || !hasIndex(resolved)) return;
      const fixed = `${specifier.slice(0, -3)}/index.js`;
      context.report({
        node: source,
        message: `디렉터리 import는 index를 명시한다: "${fixed}"`,
        fix: (fixer) => fixer.replaceText(source, `"${fixed}"`),
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
