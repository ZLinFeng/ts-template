import type { Task } from "@best-ts/shared";
import { HttpResponse, http } from "msw";

/** 测试中统一使用绝对 origin：Node 的 fetch 在 jsdom 里不支持相对 URL。 */
export const API_ORIGIN = "http://127.0.0.1:3100";

export function task(overrides: Partial<Task> = {}): Task {
  return { id: "task-1", title: "写测试", completed: false, ...overrides };
}

export const handlers = [
  http.get(`${API_ORIGIN}/api/health`, () => HttpResponse.json({ status: "ok" })),
  http.get(`${API_ORIGIN}/api/tasks`, () => HttpResponse.json([]))
];
