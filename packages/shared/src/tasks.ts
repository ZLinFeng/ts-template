import { Type, type Static } from "@sinclair/typebox";

export const TASKS_PATH = "/api/tasks";
export const TASK_TITLE_MAX_LENGTH = 120;

export const TaskSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    title: Type.String(),
    completed: Type.Boolean()
  },
  { additionalProperties: false }
);

export const TaskListSchema = Type.Array(TaskSchema);
export const CreateTaskSchema = Type.Object(
  {
    title: Type.String({ minLength: 1, maxLength: TASK_TITLE_MAX_LENGTH, pattern: "\\S" })
  },
  { additionalProperties: false }
);
export const UpdateTaskSchema = Type.Pick(TaskSchema, ["completed"], {
  additionalProperties: false
});

export type Task = Static<typeof TaskSchema>;
export type CreateTaskInput = Static<typeof CreateTaskSchema>;
export type UpdateTaskInput = Static<typeof UpdateTaskSchema>;
