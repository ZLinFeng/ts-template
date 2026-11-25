import type { Static, TSchema } from "@sinclair/typebox";
import { Check } from "@sinclair/typebox/value";
import { HEALTH_PATH, HealthResponseSchema } from "./health.ts";
import {
  TASKS_PATH,
  TaskListSchema,
  TaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput
} from "./tasks.ts";

export function createApiClient(baseUrl?: string) {
  const origin = baseUrl === undefined ? "" : new URL(baseUrl).origin;

  async function request(path: string, options?: RequestInit) {
    const timeout = AbortSignal.timeout(5_000);
    const signal = options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const response = await fetch(`${origin}${path}`, { ...options, cache: "no-store", signal });

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => undefined);
      const message =
        typeof body === "object" &&
        body !== null &&
        "message" in body &&
        typeof body.message === "string"
          ? body.message
          : response.statusText;
      throw new Error(`HTTP ${response.status}: ${message}`);
    }

    return response;
  }

  async function readJson<S extends TSchema>(
    schema: S,
    path: string,
    options?: RequestInit
  ): Promise<Static<S>> {
    const response = await request(path, options);
    const body: unknown = await response.json();
    if (!Check(schema, body)) {
      throw new Error(`Unexpected response from ${path}`);
    }
    return body;
  }

  function taskPath(id: string) {
    return `${TASKS_PATH}/${encodeURIComponent(id)}`;
  }

  return {
    health: () => readJson(HealthResponseSchema, HEALTH_PATH),
    listTasks: (signal?: AbortSignal) => readJson(TaskListSchema, TASKS_PATH, { signal }),
    createTask: (input: CreateTaskInput) =>
      readJson(TaskSchema, TASKS_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      }),
    updateTask: (id: string, input: UpdateTaskInput) =>
      readJson(TaskSchema, taskPath(id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      }),
    async removeTask(id: string) {
      await request(taskPath(id), { method: "DELETE" });
    }
  };
}
