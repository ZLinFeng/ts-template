import { createApiClient } from "@best-ts/shared";
import type { Command } from "commander";

export function registerTaskCommands(program: Command, getApiUrl: () => string) {
  const tasks = program.command("tasks").description("Manage shared tasks");
  const api = () => createApiClient(getApiUrl());

  tasks
    .command("list")
    .description("List tasks")
    .action(async () => {
      console.log(JSON.stringify(await api().listTasks(), null, 2));
    });

  tasks
    .command("add")
    .description("Create a task")
    .argument("<title>", "Task title")
    .action(async (title: string) => {
      console.log(JSON.stringify(await api().createTask({ title: title.trim() }), null, 2));
    });

  tasks
    .command("complete")
    .description("Mark a task as complete")
    .argument("<id>", "Task ID")
    .action(async (id: string) => {
      console.log(JSON.stringify(await api().updateTask(id, { completed: true }), null, 2));
    });

  tasks
    .command("reopen")
    .description("Mark a task as incomplete")
    .argument("<id>", "Task ID")
    .action(async (id: string) => {
      console.log(JSON.stringify(await api().updateTask(id, { completed: false }), null, 2));
    });

  tasks
    .command("remove")
    .description("Delete a task")
    .argument("<id>", "Task ID")
    .action(async (id: string) => {
      await api().removeTask(id);
      console.log(`Removed task ${id}`);
    });
}
