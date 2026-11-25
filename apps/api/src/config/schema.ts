import { Type, type Static } from "@sinclair/typebox";

export const LOG_LEVELS = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

const LogLevelSchema = Type.Union(LOG_LEVELS.map((level) => Type.Literal(level)));

export const ServerConfigSchema = Type.Object(
  {
    host: Type.String({ minLength: 1 }),
    port: Type.Integer({ minimum: 1, maximum: 65_535 })
  },
  { additionalProperties: false }
);

export type ServerConfig = Static<typeof ServerConfigSchema>;

export const DatabaseConfigSchema = Type.Object(
  {
    path: Type.String({ minLength: 1 })
  },
  { additionalProperties: false }
);

export type DatabaseConfig = Static<typeof DatabaseConfigSchema>;

export const LoggerConfigSchema = Type.Object(
  {
    enabled: Type.Boolean(),
    level: LogLevelSchema
  },
  { additionalProperties: false }
);

export type LoggerConfig = Static<typeof LoggerConfigSchema>;

export const ConfigSectionsSchema = Type.Object(
  {
    server: ServerConfigSchema,
    database: DatabaseConfigSchema,
    logger: LoggerConfigSchema
  },
  { additionalProperties: false }
);

export type ConfigSections = Static<typeof ConfigSectionsSchema>;

/** 环境文件允许只覆盖某个 section 的部分字段。 */
export const ConfigFileSchema = Type.Object(
  {
    server: Type.Optional(Type.Partial(ServerConfigSchema)),
    database: Type.Optional(Type.Partial(DatabaseConfigSchema)),
    logger: Type.Optional(Type.Partial(LoggerConfigSchema))
  },
  { additionalProperties: false }
);

export type ConfigFile = Static<typeof ConfigFileSchema>;

/** 对外暴露的聚合配置；每个 section 都是独立、只读的对象。 */
export interface AppConfig {
  readonly env: string;
  readonly sourceFile: string | null;
  readonly server: Readonly<ServerConfig>;
  readonly database: Readonly<DatabaseConfig>;
  readonly logger: Readonly<LoggerConfig>;
}
