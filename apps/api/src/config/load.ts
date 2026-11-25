import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_API_PORT } from "@best-ts/shared";
import { Value } from "@sinclair/typebox/value";
import { parse as parseYaml } from "yaml";
import {
  ConfigFileSchema,
  ConfigSectionsSchema,
  type AppConfig,
  type ConfigFile,
  type ConfigSections,
  type DatabaseConfig,
  type LoggerConfig,
  type ServerConfig
} from "./schema.ts";

export const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const DEFAULT_CONFIG_DIR = join(APP_ROOT, "config");

const DEFAULT_DATABASE_PATH = join(APP_ROOT, ".data", "tasks.sqlite");
const ENV_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
const ENV_REFERENCE_PATTERN = /\$(\$?)\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

export const DEFAULT_CONFIG: Readonly<ConfigSections> = Object.freeze({
  server: Object.freeze({ host: "127.0.0.1", port: DEFAULT_API_PORT }),
  database: Object.freeze({ path: DEFAULT_DATABASE_PATH }),
  logger: Object.freeze({ enabled: true, level: "info" })
});

export class ConfigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ConfigError";
  }
}

export interface LoadConfigOptions {
  /** 显式指定环境，优先于 API_ENV / NODE_ENV。 */
  env?: string;
  /** 覆盖默认的 apps/api/config 目录。 */
  configDir?: string;
  /** 显式指定配置文件，优先于目录。 */
  configFile?: string;
  /** 测试或嵌入场景可注入环境变量；默认 process.env。 */
  envVars?: NodeJS.ProcessEnv;
  /** database.path 相对路径的基准目录；默认 apps/api。 */
  appRoot?: string;
}

export interface ResolveConfigInput {
  env: string;
  /** 已解析的 YAML 文档；由该函数负责 schema 校验。 */
  file?: unknown;
  sourceFile?: string | null;
  envVars?: NodeJS.ProcessEnv;
  appRoot?: string;
}

interface EnvOverrides {
  server: Partial<ServerConfig>;
  database: Partial<DatabaseConfig>;
  logger: Partial<LoggerConfig>;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeEnvName(value: string): string {
  const env = value.trim().toLowerCase();

  if (!env) {
    throw new ConfigError("Configuration environment name must not be empty.");
  }

  if (!ENV_NAME_PATTERN.test(env)) {
    throw new ConfigError(
      `Configuration environment "${value}" is invalid; expected lowercase letters, digits and hyphens.`
    );
  }

  return env;
}

function selectEnv(optionsEnv: string | undefined, envVars: NodeJS.ProcessEnv): string {
  const configured = [optionsEnv, envVars.API_ENV, envVars.NODE_ENV].find(
    (value) => value !== undefined && value.trim() !== ""
  );

  return normalizeEnvName(configured ?? "development");
}

function resolveFromCwd(value: string): string {
  return resolve(process.cwd(), value);
}

function locateConfigFile(
  env: string,
  options: LoadConfigOptions,
  envVars: NodeJS.ProcessEnv
): string | null {
  const explicitFile = options.configFile ?? envVars.API_CONFIG_FILE;

  if (explicitFile !== undefined && explicitFile.trim() !== "") {
    const sourceFile = resolveFromCwd(explicitFile);

    if (!existsSync(sourceFile)) {
      throw new ConfigError(`Configuration file not found: ${sourceFile}`);
    }

    return sourceFile;
  }

  const configuredDir = options.configDir ?? envVars.API_CONFIG_DIR;
  const configDir =
    configuredDir !== undefined && configuredDir.trim() !== ""
      ? resolveFromCwd(configuredDir)
      : DEFAULT_CONFIG_DIR;
  const sourceFile = join(configDir, `config-${env}.yaml`);

  return existsSync(sourceFile) ? sourceFile : null;
}

function readYamlFile(sourceFile: string): unknown {
  let content: string;

  try {
    content = readFileSync(sourceFile, "utf8");
  } catch (error) {
    throw new ConfigError(`Unable to read configuration file ${sourceFile}: ${messageOf(error)}`, {
      cause: error
    });
  }

  try {
    return parseYaml(content);
  } catch (error) {
    throw new ConfigError(
      `Unable to parse YAML configuration file ${sourceFile}: ${messageOf(error)}`,
      { cause: error }
    );
  }
}

function interpolateEnvString(
  value: string,
  envVars: NodeJS.ProcessEnv,
  path: string,
  sourceFile: string | null
): string {
  return value.replace(
    ENV_REFERENCE_PATTERN,
    (match, escaped: string, name: string, fallback: string | undefined) => {
      // $$ 用于输出字面量 ${...}，避免被当成环境变量引用。
      if (escaped === "$") {
        return match.slice(1);
      }

      const resolved = envVars[name];

      if (resolved !== undefined && resolved !== "") {
        return resolved;
      }

      if (fallback !== undefined) {
        return fallback;
      }

      if (resolved !== undefined) {
        return resolved;
      }

      const label = sourceFile ? `configuration file ${sourceFile}` : "configuration overrides";
      const location = path || "/";

      throw new ConfigError(
        `Missing environment variable "${name}" referenced by ${label} at ${location}.`
      );
    }
  );
}

function interpolateEnvValues(
  value: unknown,
  envVars: NodeJS.ProcessEnv,
  path: string,
  sourceFile: string | null
): unknown {
  if (typeof value === "string") {
    return interpolateEnvString(value, envVars, path, sourceFile);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      interpolateEnvValues(item, envVars, `${path}[${index}]`, sourceFile)
    );
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        interpolateEnvValues(nested, envVars, path ? `${path}.${key}` : key, sourceFile)
      ])
    );
  }

  return value;
}

function parsePort(raw: string): number {
  const port = Number(raw);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new ConfigError(`API_PORT must be an integer between 1 and 65535 (received "${raw}").`);
  }

  return port;
}

function readEnvOverrides(envVars: NodeJS.ProcessEnv): EnvOverrides {
  const overrides: EnvOverrides = { server: {}, database: {}, logger: {} };

  if (envVars.API_HOST !== undefined) {
    overrides.server.host = envVars.API_HOST;
  }
  if (envVars.API_PORT !== undefined) {
    overrides.server.port = parsePort(envVars.API_PORT);
  }
  if (envVars.API_DB_PATH !== undefined) {
    overrides.database.path = envVars.API_DB_PATH;
  }

  return overrides;
}

function formatIssues(issues: Iterable<{ path: string; message: string }>): string {
  return [...issues].map((issue) => `  - ${issue.path || "/"}: ${issue.message}`).join("\n");
}

function resolveDatabasePath(path: string, appRoot: string): string {
  if (path === ":memory:" || isAbsolute(path)) {
    return path;
  }

  return resolve(appRoot, path);
}

/**
 * 合并默认值、文件覆盖和环境变量，插值、校验后返回冻结配置。
 * 该函数不做磁盘 IO，便于测试和复用。
 */
export function resolveConfig(input: ResolveConfigInput): AppConfig {
  const env = normalizeEnvName(input.env);
  const envVars = input.envVars ?? {};
  const sourceFile = input.sourceFile ?? null;
  const appRoot = input.appRoot ? resolveFromCwd(input.appRoot) : APP_ROOT;
  const rawFile = input.file ?? {};
  const interpolatedFile = interpolateEnvValues(rawFile, envVars, "", sourceFile);
  const fileIssues = [...Value.Errors(ConfigFileSchema, interpolatedFile)];

  if (fileIssues.length > 0) {
    const label = sourceFile ? `configuration file ${sourceFile}` : "configuration overrides";

    throw new ConfigError(`Invalid ${label}:\n${formatIssues(fileIssues)}`);
  }

  const file = interpolatedFile as ConfigFile;
  const envOverrides = readEnvOverrides(envVars);
  const merged: ConfigSections = {
    server: { ...DEFAULT_CONFIG.server, ...file.server, ...envOverrides.server },
    database: {
      ...DEFAULT_CONFIG.database,
      ...file.database,
      ...envOverrides.database
    },
    logger: { ...DEFAULT_CONFIG.logger, ...file.logger, ...envOverrides.logger }
  };
  const sectionIssues = [...Value.Errors(ConfigSectionsSchema, merged)];

  if (sectionIssues.length > 0) {
    throw new ConfigError(`Invalid resolved configuration:\n${formatIssues(sectionIssues)}`);
  }

  const databasePath = resolveDatabasePath(merged.database.path, appRoot);

  return Object.freeze({
    env,
    sourceFile,
    server: Object.freeze(merged.server),
    database: Object.freeze({ path: databasePath }),
    logger: Object.freeze(merged.logger)
  });
}

/**
 * 启动时加载配置：定位 config-{env}.yaml、解析 YAML，再交给 resolveConfig。
 * 默认环境文件缺失时回退默认值；显式 API_CONFIG_FILE 缺失则抛错。
 */
export function loadConfig(options: LoadConfigOptions = {}): AppConfig {
  const envVars = options.envVars ?? process.env;
  const env = selectEnv(options.env, envVars);
  const sourceFile = locateConfigFile(env, options, envVars);

  if (sourceFile === null) {
    return resolveConfig({
      env,
      sourceFile: null,
      envVars,
      appRoot: options.appRoot
    });
  }

  return resolveConfig({
    env,
    file: readYamlFile(sourceFile),
    sourceFile,
    envVars,
    appRoot: options.appRoot
  });
}
