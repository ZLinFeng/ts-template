import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { APP_ROOT, ConfigError, loadConfig } from "../../src/config/index.ts";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "best-ts-api-config-"));
  tempDirs.push(dir);
  return dir;
}

function writeConfig(dir: string, env: string, content: string): string {
  const file = join(dir, `config-${env}.yaml`);
  writeFileSync(file, content);
  return file;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("loadConfig", () => {
  it("uses defaults when the environment file is missing", () => {
    const dir = createTempDir();
    const config = loadConfig({ env: "test", configDir: dir, envVars: {} });

    expect(config.env).toBe("test");
    expect(config.sourceFile).toBeNull();
    expect(config.server).toEqual({ host: "127.0.0.1", port: 3000 });
    expect(config.database.path).toBe(join(APP_ROOT, ".data", "tasks.sqlite"));
    expect(config.logger).toEqual({ enabled: true, level: "info" });
  });

  it("loads an environment file and merges partial sections", () => {
    const dir = createTempDir();
    const sourceFile = writeConfig(
      dir,
      "staging",
      `
server:
  port: 4100
database:
  path: data/staging.sqlite
logger:
  level: debug
`
    );
    const config = loadConfig({
      env: "staging",
      configDir: dir,
      envVars: {},
      appRoot: dir
    });

    expect(config.env).toBe("staging");
    expect(config.sourceFile).toBe(sourceFile);
    expect(config.server).toEqual({ host: "127.0.0.1", port: 4100 });
    expect(config.database.path).toBe(resolve(dir, "data/staging.sqlite"));
    expect(config.logger).toEqual({ enabled: true, level: "debug" });
  });

  it("prefers API_ENV over NODE_ENV", () => {
    const dir = createTempDir();
    writeConfig(dir, "staging", "server:\n  port: 4200\n");

    const config = loadConfig({
      configDir: dir,
      envVars: { API_ENV: "staging", NODE_ENV: "production" }
    });

    expect(config.env).toBe("staging");
    expect(config.server.port).toBe(4200);
  });

  it("normalizes the environment name", () => {
    const dir = createTempDir();
    writeConfig(dir, "staging", "server:\n  port: 4300\n");

    const config = loadConfig({ env: " Staging ", configDir: dir, envVars: {} });

    expect(config.env).toBe("staging");
    expect(config.server.port).toBe(4300);
  });

  it("lets environment variables override file values", () => {
    const dir = createTempDir();
    writeConfig(
      dir,
      "staging",
      `
server:
  host: 0.0.0.0
  port: 4100
database:
  path: data/file.sqlite
logger:
  enabled: false
  level: warn
`
    );

    const config = loadConfig({
      env: "staging",
      configDir: dir,
      envVars: {
        API_HOST: "192.0.2.1",
        API_PORT: "5100",
        API_DB_PATH: ":memory:"
      }
    });

    expect(config.server).toEqual({ host: "192.0.2.1", port: 5100 });
    expect(config.database.path).toBe(":memory:");
    expect(config.logger).toEqual({ enabled: false, level: "warn" });
  });

  it("interpolates environment variables in YAML strings", () => {
    const dir = createTempDir();
    writeConfig(
      dir,
      "env-ref",
      [
        "database:",
        "  path: ${DATA_DIR}/tasks.sqlite",
        "logger:",
        "  level: ${LOG_LEVEL:-debug}"
      ].join("\n")
    );

    const config = loadConfig({
      env: "env-ref",
      configDir: dir,
      envVars: { DATA_DIR: "/var/lib/best-ts", LOG_LEVEL: "warn" },
      appRoot: dir
    });

    expect(config.database.path).toBe("/var/lib/best-ts/tasks.sqlite");
    expect(config.logger.level).toBe("warn");
  });

  it("uses the interpolation fallback when a variable is unset", () => {
    const dir = createTempDir();
    writeConfig(dir, "env-fallback", "logger:\n  level: ${LOG_LEVEL:-debug}\n");

    const config = loadConfig({
      env: "env-fallback",
      configDir: dir,
      envVars: {},
      appRoot: dir
    });

    expect(config.logger.level).toBe("debug");
  });

  it("fails when a referenced environment variable is missing", () => {
    const dir = createTempDir();
    writeConfig(dir, "env-missing", "database:\n  path: ${MISSING_DB_PATH}\n");

    expect(() =>
      loadConfig({ env: "env-missing", configDir: dir, envVars: {}, appRoot: dir })
    ).toThrow(ConfigError);
    expect(() =>
      loadConfig({ env: "env-missing", configDir: dir, envVars: {}, appRoot: dir })
    ).toThrow(/MISSING_DB_PATH/);
    expect(() =>
      loadConfig({ env: "env-missing", configDir: dir, envVars: {}, appRoot: dir })
    ).toThrow(/database\.path/);
  });

  it("supports escaping interpolation with $$", () => {
    const dir = createTempDir();
    writeConfig(dir, "env-escaped", 'database:\n  path: "$${LITERAL_PATH}/tasks.sqlite"\n');

    const config = loadConfig({
      env: "env-escaped",
      configDir: dir,
      envVars: {},
      appRoot: dir
    });

    expect(config.database.path).toBe(resolve(dir, "${LITERAL_PATH}/tasks.sqlite"));
  });

  it("does not recursively interpolate environment variable values", () => {
    const dir = createTempDir();
    writeConfig(dir, "env-nested", "server:\n  host: ${HOST_VALUE}\n");

    const config = loadConfig({
      env: "env-nested",
      configDir: dir,
      envVars: { HOST_VALUE: "${INNER}" },
      appRoot: dir
    });

    expect(config.server.host).toBe("${INNER}");
  });

  it("supports an explicit config file through API_CONFIG_FILE", () => {
    const dir = createTempDir();
    const sourceFile = join(dir, "custom.yaml");
    writeFileSync(sourceFile, "server:\n  port: 4400\n");

    const config = loadConfig({
      env: "anything",
      envVars: { API_CONFIG_FILE: sourceFile }
    });

    expect(config.sourceFile).toBe(sourceFile);
    expect(config.server.port).toBe(4400);
  });

  it("fails when an explicit config file is missing", () => {
    const dir = createTempDir();

    expect(() =>
      loadConfig({
        env: "test",
        configFile: join(dir, "missing.yaml"),
        envVars: {}
      })
    ).toThrow(ConfigError);
    expect(() =>
      loadConfig({
        env: "test",
        configFile: join(dir, "missing.yaml"),
        envVars: {}
      })
    ).toThrow(/not found/);
  });

  it("rejects an environment name that could escape the config directory", () => {
    const dir = createTempDir();

    expect(() => loadConfig({ env: "../production", configDir: dir, envVars: {} })).toThrow(
      ConfigError
    );
    expect(() => loadConfig({ env: "../production", configDir: dir, envVars: {} })).toThrow(
      /invalid/
    );
  });

  it("reports YAML syntax errors with the file path", () => {
    const dir = createTempDir();
    writeConfig(dir, "broken", "server: [");

    expect(() => loadConfig({ env: "broken", configDir: dir, envVars: {} })).toThrow(
      /Unable to parse YAML configuration file/
    );
  });

  it("rejects unknown fields and wrong scalar types", () => {
    const dir = createTempDir();
    writeConfig(dir, "unknown", "server:\n  host: 127.0.0.1\n  port: 3000\n  extra: true\n");
    writeConfig(dir, "wrong-type", 'server:\n  port: "3000"\n');

    expect(() => loadConfig({ env: "unknown", configDir: dir, envVars: {} })).toThrow(
      /server\/extra/
    );
    expect(() => loadConfig({ env: "wrong-type", configDir: dir, envVars: {} })).toThrow(
      /server\/port/
    );
  });

  it("rejects invalid environment overrides", () => {
    const dir = createTempDir();

    expect(() =>
      loadConfig({
        env: "test",
        configDir: dir,
        envVars: { API_PORT: "not-a-port" }
      })
    ).toThrow(/API_PORT must be an integer/);
    expect(() =>
      loadConfig({
        env: "test",
        configDir: dir,
        envVars: { API_HOST: "" }
      })
    ).toThrow(/server\/host/);
  });

  it("treats an empty YAML document as no overrides", () => {
    const dir = createTempDir();
    const sourceFile = writeConfig(dir, "empty", "# only comments\n");

    const config = loadConfig({ env: "empty", configDir: dir, envVars: {} });

    expect(config.sourceFile).toBe(sourceFile);
    expect(config.server).toEqual({ host: "127.0.0.1", port: 3000 });
    expect(config.logger).toEqual({ enabled: true, level: "info" });
  });

  it("freezes the aggregate config and each section", () => {
    const dir = createTempDir();
    const config = loadConfig({ env: "test", configDir: dir, envVars: {} });

    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.server)).toBe(true);
    expect(Object.isFrozen(config.database)).toBe(true);
    expect(Object.isFrozen(config.logger)).toBe(true);
  });
});
