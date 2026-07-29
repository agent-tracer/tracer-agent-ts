import path from "node:path";

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

import { ALIASES, AMBIENT, DOMAIN_UNITS, ROOTS } from "./architecture.manifest.mjs";
import { localPlugin } from "./eslint-rules/index.mjs";

const ROOT = import.meta.dirname;
const UNIT_SOURCES = ROOTS.map((root) => `${root}/**/*.{ts,tsx}`);

// 배포 단위마다 자기 별칭만 준다. 별칭 표는 아키텍처 매니페스트가 소유한다.
const aliasOptionsOf = (unitAlias) => ({
  aliases: { [unitAlias]: path.join(ROOT, ALIASES[unitAlias]) },
});

// 어떤 계층이 무엇을 만지지 못하는지는 아키텍처 매니페스트가 소유하고 여기서는 옮기기만 한다.
const ambientRuleConfigs = AMBIENT.layers.flatMap((layer) =>
  DOMAIN_UNITS.map((unit) => ({
    files: [`${unit.dir}/src/domain/*/${layer}/**/*.ts`],
    ignores: ["**/*.test.ts", "**/__fakes__/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...AMBIENT.banned.map(({ name, syntax }) => ({
          selector: syntax,
          message: `${name} 의존은 ${AMBIENT.message}`,
        })),
      ],
    },
  })),
);

const pathRuleConfigs = Object.keys(ALIASES).map((alias) => ({
  files: [`${ALIASES[alias]}/**/*.{ts,tsx}`],
  plugins: { local: localPlugin },
  rules: {
    "local/require-js-extension": "error",
    "local/no-deep-relative-import": ["error", aliasOptionsOf(alias)],
    "local/prefer-barrel-index": ["error", aliasOptionsOf(alias)],
  },
}));

export default tseslint.config(
  {
    ignores: [
      "**/dist/**", "**/build/**", "**/coverage/**", "**/node_modules/**", "**/*.d.ts",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  // 설정과 검사 스크립트는 어떤 tsconfig에도 없으므로 타입 정보를 만들 수 없다.
  {
    files: ["**/*.{js,cjs,mjs}"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { globals: { ...globals.node } },
  },

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: ROOT },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/return-await": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        varsIgnorePattern: "^_",
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },

  ...pathRuleConfigs,

  {
    files: [...UNIT_SOURCES, "scripts/**/*.mjs", "eslint-rules/**/*.mjs", "*.mjs"],
    plugins: { local: localPlugin },
    rules: { "local/comment-language": "error" },
  },

  ...ambientRuleConfigs,

  {
    files: ["**/*.test.{ts,tsx,mjs}", "**/__fakes__/**/*.{ts,tsx}"],
    plugins: { local: localPlugin },
    rules: {
      "no-restricted-syntax": "off",
      "local/korean-test-title": "error",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/require-await": "off",
    },
  },
);
