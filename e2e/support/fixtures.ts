import { test as base, expect, request, type APIRequestContext } from "@playwright/test";

interface Fixtures {
  api: APIRequestContext;
  runId: string;
}

/**
 * - api：固定指向后端的请求上下文（本地走 web 代理，远程可配 E2E_API_URL）。
 * - runId：当前用例唯一前缀；用例结束后自动清理本轮写入的数据，
 *   因此即使打到研发环境的真实数据库，也只删除本次运行创建的任务。
 */
export const test = base.extend<Fixtures>({
  api: async ({ baseURL }, use) => {
    const context = await request.newContext({ baseURL: process.env.E2E_API_URL ?? baseURL });
    await use(context);
    await context.dispose();
  },
  runId: async ({ api }, use) => {
    const runId = `e2e-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    await use(runId);

    const response = await api.get("/api/tasks");
    if (!response.ok()) return;

    const tasks = (await response.json()) as { id: string; title: string }[];
    await Promise.all(
      tasks
        .filter((task) => task.title.startsWith(runId))
        .map((task) => api.delete(`/api/tasks/${task.id}`))
    );
  }
});

export { expect };
