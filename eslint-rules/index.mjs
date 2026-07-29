import { commentLanguage } from "./comment-language.mjs";
import { koreanTestTitle } from "./korean-test-title.mjs";
import { noDeepRelativeImport } from "./no-deep-relative-import.mjs";
import { preferBarrelIndex } from "./prefer-barrel-index.mjs";
import { requireJsExtension } from "./require-js-extension.mjs";

/** 저장소가 소유한 린트 규칙이며 경계 규칙은 의존 그래프 검사기가 따로 소유한다. */
export const localPlugin = {
  rules: {
    "require-js-extension": requireJsExtension,
    "no-deep-relative-import": noDeepRelativeImport,
    "prefer-barrel-index": preferBarrelIndex,
    "comment-language": commentLanguage,
    "korean-test-title": koreanTestTitle,
  },
};
