import { defineConfig } from "vitest/config";

// 배포 단위마다 vitest를 따로 띄우면 부팅과 수집 비용을 그 수만큼 다시 낸다.
export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.ts",
      "packages/*/vite.config.ts",
      "packages/server/*/*/vitest.config.ts",
    ],
  },
});
