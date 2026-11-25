import { createApiClient } from "@best-ts/shared";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { useTasks } from "@/features/tasks/use-tasks";
import { API_ORIGIN, task } from "../../mocks/handlers";
import { server } from "../../mocks/server";

function renderTasks() {
  const api = createApiClient(API_ORIGIN);
  return renderHook(() => useTasks(api));
}

async function waitForLoad(result: { current: ReturnType<typeof useTasks> }) {
  await waitFor(() => expect(result.current.pending).toBe(false));
}

describe("useTasks", () => {
  it("loads tasks on mount", async () => {
    const tasks = [task({ id: "1", title: "写测试" })];
    server.use(http.get(`${API_ORIGIN}/api/tasks`, () => HttpResponse.json(tasks)));

    const { result } = renderTasks();
    expect(result.current.pending).toBe(true);

    await waitForLoad(result);
    expect(result.current.tasks).toEqual(tasks);
    expect(result.current.error).toBeNull();
  });

  it("reports a load error", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/tasks`, () =>
        HttpResponse.json({ message: "boom" }, { status: 500 })
      )
    );

    const { result } = renderTasks();
    await waitForLoad(result);

    expect(result.current.tasks).toBeNull();
    expect(result.current.error).toContain("无法读取任务");
  });

  it("refreshes the list", async () => {
    let calls = 0;
    server.use(
      http.get(`${API_ORIGIN}/api/tasks`, () => {
        calls += 1;
        return HttpResponse.json(calls === 1 ? [] : [task({ id: "2", title: "refreshed" })]);
      })
    );

    const { result } = renderTasks();
    await waitForLoad(result);
    expect(result.current.tasks).toEqual([]);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.tasks).toEqual([task({ id: "2", title: "refreshed" })]);
  });

  it("prepends a created task", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/tasks`, () =>
        HttpResponse.json([task({ id: "1", title: "existing" })])
      ),
      http.post(`${API_ORIGIN}/api/tasks`, async ({ request }) => {
        const body = (await request.json()) as { title: string };
        return HttpResponse.json({ id: "2", title: body.title, completed: false }, { status: 201 });
      })
    );

    const { result } = renderTasks();
    await waitForLoad(result);

    let created = false;
    await act(async () => {
      created = await result.current.create("new task");
    });

    expect(created).toBe(true);
    expect(result.current.tasks?.[0]).toMatchObject({ id: "2", title: "new task" });
    expect(result.current.tasks).toHaveLength(2);
  });

  it("updates completion and removes tasks", async () => {
    server.use(
      http.get(`${API_ORIGIN}/api/tasks`, () =>
        HttpResponse.json([task({ id: "1", title: "写测试" })])
      ),
      http.patch(`${API_ORIGIN}/api/tasks/:id`, async ({ request }) => {
        const body = (await request.json()) as { completed: boolean };
        return HttpResponse.json(task({ id: "1", title: "写测试", completed: body.completed }));
      }),
      http.delete(`${API_ORIGIN}/api/tasks/:id`, () => new HttpResponse(null, { status: 204 }))
    );

    const { result } = renderTasks();
    await waitForLoad(result);

    await act(async () => {
      await result.current.setCompleted("1", true);
    });
    expect(result.current.tasks?.[0]).toMatchObject({ id: "1", completed: true });

    await act(async () => {
      await result.current.remove("1");
    });
    expect(result.current.tasks).toEqual([]);
  });
});
