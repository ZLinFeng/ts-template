#!/usr/bin/env node
import { DEFAULT_API_PORT } from "@best-ts/shared";
import { Command } from "commander";
import { registerHealthCommand } from "./features/health/command.ts";
import { registerTaskCommands } from "./features/tasks/commands.ts";

const port = process.env.API_PORT ?? DEFAULT_API_PORT;
const program = new Command()
  .name("best-ts-admin")
  .description("Manage the workspace API")
  .option("--api-url <url>", "API origin", process.env.API_URL ?? `http://127.0.0.1:${port}`)
  .helpCommand(true)
  .action(() => program.outputHelp());

const getApiUrl = () => program.opts<{ apiUrl: string }>().apiUrl;

registerHealthCommand(program, getApiUrl);
registerTaskCommands(program, getApiUrl);

try {
  await program.parseAsync();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
