import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import type { AppConfig } from "./schema.ts";

export interface ConfigPluginOptions {
  config: AppConfig;
}

const plugin: FastifyPluginAsync<ConfigPluginOptions> = async (app, { config }) => {
  app.decorate("config", config);
};

/**
 * fastify-plugin 会移除封装边界，让 app.config 对同级路由插件可见。
 */
export const configPlugin = fp(plugin, {
  name: "best-ts-api-config",
  fastify: "5.x"
});

declare module "fastify" {
  interface FastifyInstance {
    config: AppConfig;
  }
}
