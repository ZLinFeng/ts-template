import { defineConfig, devices } from "@playwright/test";

const remoteBaseUrl = process.env.E2E_BASE_URL?.trim();
const isRemote = Boolean(remoteBaseUrl);

if (isRemote && process.env.E2E_ALLOW_REMOTE !== "1") {
  throw new Error(
    "E2E_BASE_URL 已设置，但缺少 E2E_ALLOW_REMOTE=1。远程模式会读写真实数据，请显式确认。"
  );
}

const webPort = Number(process.env.E2E_WEB_PORT ?? 5273);
const apiPort = Number(process.env.E2E_API_PORT ?? 3100);
const baseURL = remoteBaseUrl ?? `http://127.0.0.1:${webPort}`;
const browserChannel = process.env.E2E_BROWSER_CHANNEL;
const storageState = process.env.E2E_STORAGE_STATE;

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: false,
  // 本地与远程共用同一个后端数据库，先串行保证数据隔离；需要并行时可配合唯一 runId 调整
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ...(browserChannel ? { channel: browserChannel } : {}),
    ...(storageState ? { storageState } : {})
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: isRemote
    ? undefined
    : [
        {
          name: "api",
          command: "pnpm --filter ./apps/api exec node --conditions=development src/index.ts",
          url: `http://127.0.0.1:${apiPort}/api/health`,
          env: { API_PORT: String(apiPort), API_DB_PATH: ":memory:" },
          reuseExistingServer: false,
          timeout: 60_000
        },
        {
          name: "web",
          command: `pnpm --filter ./apps/web exec vite --port ${webPort}`,
          url: `http://127.0.0.1:${webPort}`,
          env: { API_PORT: String(apiPort) },
          reuseExistingServer: false,
          timeout: 60_000
        }
      ]
});
