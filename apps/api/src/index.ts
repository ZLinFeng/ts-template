import { buildApp } from "./app.ts";
import { ConfigError, loadConfig } from "./config/index.ts";

async function main() {
  const config = loadConfig();
  const app = buildApp({ config });

  app.log.info({ env: config.env, sourceFile: config.sourceFile }, "configuration loaded");

  try {
    await app.listen({ port: config.server.port, host: config.server.host });

    const shutdown = () => {
      void app.close().catch((error) => {
        app.log.error(error);
        process.exitCode = 1;
      });
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    app.log.error(error);
    await app.close();
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  const prefix = error instanceof ConfigError ? "Configuration error" : "Failed to start API";
  const detail =
    error instanceof ConfigError
      ? error.message
      : error instanceof Error
        ? (error.stack ?? error.message)
        : String(error);

  process.stderr.write(`${prefix}:\n${detail}\n`);
  process.exitCode = 1;
}
