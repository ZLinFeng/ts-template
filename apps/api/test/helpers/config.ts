import { resolveConfig } from "../../src/config/load.ts";
import type { AppConfig } from "../../src/config/schema.ts";

/** 测试配置：内存数据库、关闭日志，并允许按需覆盖环境变量。 */
export function createTestConfig(envVars: NodeJS.ProcessEnv = {}): AppConfig {
  return resolveConfig({
    env: "test",
    file: { logger: { enabled: false, level: "info" } },
    envVars: { API_DB_PATH: ":memory:", ...envVars }
  });
}
