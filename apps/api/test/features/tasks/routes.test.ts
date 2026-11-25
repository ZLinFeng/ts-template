import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp } from "../../helpers/app.ts";

interface Task {
  id: string;
  title: string;
  completed: boolean;
}

let app: FastifyInstance;

beforeEach(() => {
  app = createTestApp();
});

afterEach(async () => {
  await app.close();
});

async function createTask(title: string) {
  const response = await app.inject({ method: "POST", url: "/api/tasks", payload: { title } });
  expect(response.statusCode).toBe(201);
  return response.json() as Task;
}

async function listTasks() {
  const response = await app.inject({ method: "GET", url: "/api/tasks" });
  expect(response.statusCode).toBe(200);
  return response.json() as Task[];
}

describe("task routes", () => {
  it("creates a task and lists it", async () => {
    const task = await createTask("写测试");

    expect(task).toMatchObject({ title: "写测试", completed: false });
    expect(typeof task.id).toBe("string");
    expect(await listTasks()).toEqual([task]);
  });

  it("lists the newest task first", async () => {
    const first = await createTask("first");
    const second = await createTask("second");

    expect((await listTasks()).map((task) => task.id)).toEqual([second.id, first.id]);
  });

  it("trims the title before storing it", async () => {
    const task = await createTask("  带空格  ");

    expect(task.title).toBe("带空格");
  });

  it("marks a task as complete and back", async () => {
    const task = await createTask("toggle");

    const completed = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${task.id}`,
      payload: { completed: true }
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json()).toMatchObject({ id: task.id, completed: true });

    const reopened = await app.inject({
      method: "PATCH",
      url: `/api/tasks/${task.id}`,
      payload: { completed: false }
    });
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json()).toMatchObject({ id: task.id, completed: false });
  });

  it("returns 404 when updating an unknown task", async () => {
    const response = await app.inject({
      method: "PATCH",
      url: "/api/tasks/missing",
      payload: { completed: true }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ message: "Task not found" });
  });

  it("deletes a task and returns 404 afterwards", async () => {
    const task = await createTask("delete me");

    const removed = await app.inject({ method: "DELETE", url: `/api/tasks/${task.id}` });
    expect(removed.statusCode).toBe(204);
    expect(await listTasks()).toEqual([]);

    const removedAgain = await app.inject({ method: "DELETE", url: `/api/tasks/${task.id}` });
    expect(removedAgain.statusCode).toBe(404);
  });

  it.each([
    { label: "empty title", payload: { title: "" } },
    { label: "whitespace-only title", payload: { title: "   " } },
    { label: "too long title", payload: { title: "x".repeat(121) } },
    { label: "missing title", payload: {} },
    { label: "wrong title type", payload: { title: 42 } },
    { label: "extra properties", payload: { title: "ok", extra: true } }
  ])("rejects $label with 400", async ({ payload }) => {
    const response = await app.inject({ method: "POST", url: "/api/tasks", payload });

    expect(response.statusCode).toBe(400);
  });
});
