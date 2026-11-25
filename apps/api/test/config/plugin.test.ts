import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.ts";
import { createTestConfig } from "../helpers/config.ts";

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("config plugin", () => {
  it("exposes config to sibling plugins", async () => {
    app = buildApp({ config: createTestConfig() });

    app.register(async (child) => {
      child.get("/api/config-probe", async () => ({
        env: child.config.env,
        dbPath: child.config.database.path
      }));
    });

    const response = await app.inject({ method: "GET", url: "/api/config-probe" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ env: "test", dbPath: ":memory:" });
    expect(app.config.database.path).toBe(":memory:");
  });
});
