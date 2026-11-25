import Fastify from "fastify";
import { configPlugin } from "./config/plugin.ts";
import type { AppConfig } from "./config/schema.ts";
import { healthRoutes } from "./features/health/routes.ts";
import { taskRoutes } from "./features/tasks/routes.ts";

interface AppOptions {
  config: AppConfig;
}

export function buildApp({ config }: AppOptions) {
  const app = Fastify({
    logger: config.logger.enabled ? { level: config.logger.level } : false,
    ajv: {
      customOptions: { coerceTypes: false, removeAdditional: false }
    }
  });

  app.register(configPlugin, { config });
  app.register(healthRoutes);
  app.register(taskRoutes, { dbPath: config.database.path });

  return app;
}
