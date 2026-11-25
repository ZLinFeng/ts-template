import {
  CreateTaskSchema,
  TASKS_PATH,
  TaskListSchema,
  TaskSchema,
  UpdateTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput
} from "@best-ts/shared";
import type { FastifyPluginAsync } from "fastify";
import { openTaskStore } from "./store.ts";

type TaskParams = { id: string };

export const taskRoutes: FastifyPluginAsync<{ dbPath: string }> = async (app, { dbPath }) => {
  const store = openTaskStore(dbPath);
  app.addHook("onClose", async () => store.close());

  app.get(TASKS_PATH, { schema: { response: { 200: TaskListSchema } } }, async () => store.list());

  app.post<{ Body: CreateTaskInput }>(
    TASKS_PATH,
    { schema: { body: CreateTaskSchema, response: { 201: TaskSchema } } },
    async (request, reply) => reply.code(201).send(store.create(request.body.title.trim()))
  );

  app.patch<{ Params: TaskParams; Body: UpdateTaskInput }>(
    `${TASKS_PATH}/:id`,
    { schema: { body: UpdateTaskSchema, response: { 200: TaskSchema } } },
    async (request, reply) => {
      const task = store.setCompleted(request.params.id, request.body.completed);
      if (!task) {
        return reply.code(404).send({ message: "Task not found" });
      }
      return task;
    }
  );

  app.delete<{ Params: TaskParams }>(`${TASKS_PATH}/:id`, async (request, reply) => {
    if (!store.remove(request.params.id)) {
      return reply.code(404).send({ message: "Task not found" });
    }
    return reply.code(204).send();
  });
};
