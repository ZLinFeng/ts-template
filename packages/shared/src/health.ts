import { Type, type Static } from "@sinclair/typebox";

export const DEFAULT_API_PORT = 3000;
export const HEALTH_PATH = "/api/health";
export const HealthResponseSchema = Type.Object(
  { status: Type.Literal("ok") },
  { additionalProperties: false }
);

export type HealthResponse = Static<typeof HealthResponseSchema>;
