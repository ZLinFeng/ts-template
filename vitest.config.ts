import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const path = (target: string) => fileURLToPath(new URL(target, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path("./apps/web/src")
    },
    // 让测试直接解析 workspace 源码，无需先构建 @best-ts/shared
    conditions: ["development"]
  },
  test: {
    projects: [
      {
        test: {
          name: "api",
          root: path("./apps/api"),
          environment: "node",
          include: ["test/**/*.test.ts"]
        }
      },
      {
        test: {
          name: "web",
          root: path("./apps/web"),
          environment: "jsdom",
          include: ["test/**/*.test.{ts,tsx}"],
          setupFiles: [path("./apps/web/test/setup.ts")]
        }
      }
    ],
    coverage: {
      provider: "v8",
      include: ["apps/api/src/**/*.ts", "apps/web/src/**/*.{ts,tsx}"],
      exclude: [
        "apps/api/src/index.ts",
        "apps/web/src/main.tsx",
        "apps/web/src/components/ui/**",
        "apps/web/src/lib/**"
      ],
      reporter: ["text", "lcov"],
      thresholds: {
        "apps/api/src/features/**": { lines: 80, functions: 80, branches: 65, statements: 80 },
        "apps/web/src/features/**": { lines: 75, functions: 70, branches: 60, statements: 75 }
      }
    }
  }
});
