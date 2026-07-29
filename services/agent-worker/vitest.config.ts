import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths({ root: "../.." })],
  esbuild: { target: "es2022" },
  test: {
    name: "agent-worker",
    include: ["src/**/*.test.ts"],
  },
});
