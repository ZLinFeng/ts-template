import { HEALTH_PATH, HealthResponseSchema, type HealthResponse } from "@best-ts/shared";
import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: HealthResponse }>(
    HEALTH_PATH,
    { schema: { response: { 200: HealthResponseSchema } } },
    async () => ({ status: "ok" })
  );
};
