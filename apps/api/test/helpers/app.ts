import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.ts";
import { createTestConfig } from "./config.ts";

/** 每个测试使用独立的内存数据库，结束后必须关闭。 */
export function createTestApp(): FastifyInstance {
  return buildApp({ config: createTestConfig() });
}
