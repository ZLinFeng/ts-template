import { createApiClient, type Task } from "@best-ts/shared";
import { useEffect, useState } from "react";

type TaskApi = ReturnType<typeof createApiClient>;

const defaultApi = createApiClient();
const loadError = "无法读取任务，请检查 API 是否运行后重试。";

export function useTasks(api: TaskApi = defaultApi) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    void api
      .listTasks(signal)
      .then((result) => {
        if (!signal.aborted) setTasks(result);
      })
      .catch(() => {
        if (!signal.aborted) setError(loadError);
      })
      .finally(() => {
        if (!signal.aborted) setPending(false);
      });

    return () => controller.abort();
  }, [api]);

  async function run(operation: () => Promise<void>, errorMessage: string) {
    setPending(true);
    setError(null);
    try {
      await operation();
      return true;
    } catch {
      setError(errorMessage);
      return false;
    } finally {
      setPending(false);
    }
  }

  return {
    tasks,
    pending,
    error,
    refresh: () =>
      run(async () => {
        setTasks(await api.listTasks());
      }, loadError),
    create: (title: string) =>
      run(async () => {
        const task = await api.createTask({ title });
        setTasks((current) => [task, ...(current ?? [])]);
      }, "添加任务失败，请重试。"),
    setCompleted: (id: string, completed: boolean) =>
      run(async () => {
        const updated = await api.updateTask(id, { completed });
        setTasks((current) => current?.map((task) => (task.id === id ? updated : task)) ?? null);
      }, "更新任务失败，请刷新列表后重试。"),
    remove: (id: string) =>
      run(async () => {
        await api.removeTask(id);
        setTasks((current) => current?.filter((task) => task.id !== id) ?? null);
      }, "删除任务失败，请刷新列表后重试。")
  };
}
