import type { APIRequestContext } from "@playwright/test";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
}

export async function createTask(api: APIRequestContext, title: string): Promise<Task> {
  const response = await api.post("/api/tasks", { data: { title } });
  if (!response.ok()) {
    throw new Error(`创建任务失败：HTTP ${response.status()}`);
  }
  return (await response.json()) as Task;
}

export async function listTasks(api: APIRequestContext): Promise<Task[]> {
  const response = await api.get("/api/tasks");
  if (!response.ok()) {
    throw new Error(`读取任务失败：HTTP ${response.status()}`);
  }
  return (await response.json()) as Task[];
}
