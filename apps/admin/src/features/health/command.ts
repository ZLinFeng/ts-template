import { createApiClient, HEALTH_PATH } from "@best-ts/shared";
import type { Command } from "commander";

export function registerHealthCommand(program: Command, getApiUrl: () => string) {
  program
    .command("health")
    .description("Check the health of the API")
    .action(async () => {
      const apiUrl = getApiUrl();
      try {
        await createApiClient(apiUrl).health();
        console.log(`API is healthy (${new URL(HEALTH_PATH, apiUrl).href})`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`API health check failed: ${message}`, { cause: error });
      }
    });
}
