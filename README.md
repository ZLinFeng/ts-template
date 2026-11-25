# Best TS Template

<!-- template:start -->

## 从模板创建项目

这是可运行、可测试的 TypeScript workspace 模板。仓库里的 `best-ts` 是模板默认身份；创建新项目时用一次性脚本替换成目标身份，而不是把项目名做成运行期环境变量。

```sh
git clone --depth 1 https://github.com/ZLinFeng/ts-template.git my-app
cd my-app
rm -rf .git
node scripts/init-template.mjs --name my-app --scope @my-scope --display-name "My App"
rm -rf skills scripts/init-template.mjs   # 可选：不再需要生成器时删除
pnpm install        # 重新生成 pnpm-lock.yaml
pnpm check
pnpm build
```

脚本会先校验 `--name` 和 `--scope`，再按“先长后短”的顺序替换文件内容，最后检查 `package.json`、`@scope` 包名、Admin bin 名和残留标识。可以先加 `--dry-run` 预览会改哪些文件。

| 参数             | 影响                                                                  |
| ---------------- | --------------------------------------------------------------------- |
| `--name`         | 根包名、镜像名前缀、Compose 项目名、K8s namespace、`<name>-admin` CLI |
| `--scope`        | `@best-ts/api`、`@best-ts/web`、`@best-ts/admin`、`@best-ts/shared`   |
| `--display-name` | README 标题和 Web 页面标题                                            |

改名后必须执行 `pnpm install`，否则 `pnpm-lock.yaml` 里的 import specifier 仍是旧值，Docker 的 `--frozen-lockfile` 会失败。模板仓库自身保持可安装、可运行，方便 `pnpm check` 持续验证模板没有腐烂。

如果使用本仓库配套的 DSH skill，可直接运行 `skills/init-ts-project` 中的脚手架，它会完成克隆、改名、安装、检查和构建：

```sh
node skills/init-ts-project/scripts/scaffold.mjs \
  --template . \
  --dir ../my-app \
  --name my-app \
  --scope @my-scope \
  --display-name "My App"
```

本模板仓库为 <https://github.com/ZLinFeng/ts-template>。在 GitHub 仓库 Settings 中勾选 Template repository 后，即可通过 “Use this template” 创建项目；skill 的 `config.json` 已指向该仓库。
<!-- template:end -->

基于 pnpm workspace 的 TypeScript 工程。Web 和管理 CLI 通过同一个 Fastify API 读写任务，数据持久化在本地 SQLite 文件中。

| 目录              | 职责                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `apps/web`        | Vite、React、shadcn/ui 和 Tailwind CSS。任务页面和数据请求位于 `src/features/tasks/`                               |
| `apps/api`        | Fastify。任务路由和存储位于 `src/features/tasks/`，健康检查位于 `src/features/health/`，配置加载位于 `src/config/` |
| `apps/admin`      | Commander。各功能在自己的 `src/features/` 子目录中注册命令                                                         |
| `packages/shared` | TypeBox 接口 schema、TypeScript 类型和供 Web、CLI 使用的 HTTP 客户端                                               |

## 本地开发

使用 Node.js 24.15+ 和 pnpm 11.20.0。在项目根目录执行以下命令。

```sh
pnpm install
pnpm dev
```

Web 默认运行在 `http://127.0.0.1:5173`，API 默认监听 `127.0.0.1:3000`。Vite 将 `/api` 请求代理到后端。

`pnpm dev` 先并行检查三个应用，全部通过后再启动。Admin 是一次性执行的 CLI，全量启动时它会输出帮助，Web 和 API 会继续监听。也可以从根目录单独运行开发任务。

```sh
pnpm dev:web
pnpm dev:api
pnpm dev:admin --help
pnpm dev:admin tasks list
```

在 Web 页面添加任务后，另开一个终端执行 `pnpm admin tasks list`。CLI 会返回 JSON，包含同一条任务及其 ID。在 CLI 添加、完成或删除任务后，点击 Web 页面的「刷新」即可看到结果。

```sh
pnpm admin --help
pnpm admin health
pnpm admin tasks list
pnpm admin tasks add "验证 workspace 联调"
TASK_ID="替换为已创建任务的 ID"
pnpm admin tasks complete "$TASK_ID"
pnpm admin tasks reopen "$TASK_ID"
pnpm admin tasks remove "$TASK_ID"
```

API 接口包含 `GET /api/health`、`GET /api/tasks`、`POST /api/tasks`、`PATCH /api/tasks/:id` 和 `DELETE /api/tasks/:id`。

## 配置

API 启动时按以下优先级加载配置：

1. `apps/api/src/config/load.ts` 中的内置默认值；
2. `apps/api/config/config-{env}.yaml`；
3. `API_*` 环境变量。

`env` 依次取 `API_ENV`、`NODE_ENV`、`development`，统一转为小写；非法环境名（例如包含 `../`）会在读取文件前被拒绝。默认环境文件不存在时回退默认值 + 环境变量；通过 `API_CONFIG_FILE` 显式指定的文件不存在时启动失败。

```yaml
# apps/api/config/config-development.yaml
server:
  host: 127.0.0.1
  port: 3000
database:
  path: .data/tasks.sqlite
logger:
  enabled: true
  level: info
```

环境文件可以只写需要覆盖的 section 或字段：

```yaml
server:
  port: 3100
logger:
  level: debug
```

`database.path` 的相对路径按 `apps/api` 解析，`:memory:` 原样保留。YAML 字符串支持 `${VAR}` 和 `${VAR:-default}` 环境变量插值，例如：

```yaml
database:
  path: ${DATABASE_PATH:-.data/tasks.sqlite}
```

引用未定义且没有默认值的变量会导致启动失败；`$${VAR}` 会输出字面量 `${VAR}`，不进行插值。插值结果仍是字符串，数值/布尔字段（如 `server.port`、`logger.enabled`）不要使用插值，端口请用 `API_PORT` 覆盖。出于安全考虑，不支持执行任意 JS 的 YAML tag（例如 `!!js/process.env`）。

配置加载后会冻结并注入 Fastify：`app.config.server`、`app.config.database`、`app.config.logger`。配置插件通过 `fastify-plugin` 注册到根作用域，同级路由插件可以直接读取 `app.config`。API 不提供 HTTP 配置接口；配置文件中不要存放密钥，敏感值用环境变量覆盖。

| 配置                     | 用途                                                                              |
| ------------------------ | --------------------------------------------------------------------------------- |
| `API_PORT`               | API 端口，覆盖 YAML 的 `server.port`。修改时需同时用于 `pnpm dev` 和 `pnpm admin` |
| `API_HOST`               | API 监听地址，覆盖 YAML 的 `server.host`，默认 `127.0.0.1`                        |
| `API_DB_PATH`            | SQLite 文件路径，覆盖 YAML 的 `database.path`                                     |
| `API_ENV`                | 选择 `config-{env}.yaml`，优先于 `NODE_ENV`，默认 `development`                   |
| `API_CONFIG_DIR`         | 配置目录，默认 `apps/api/config`                                                  |
| `API_CONFIG_FILE`        | 指定配置文件，优先于目录；文件缺失时启动失败                                      |
| `API_URL` 或 `--api-url` | 指定 CLI 访问的 API 地址，命令行参数优先                                          |

根目录提供 [.env.example](.env.example) 作为变量清单。应用不会自动加载 `.env`，请通过 shell、Docker 或 Kubernetes 注入；其中只放非敏感默认值，密钥不要写进仓库。

> API 从 YAML 读取 `server.port`/`server.host`；Web 的 Vite 代理和 Admin CLI 仍读取 `API_PORT`。如果在 YAML 中修改端口，需同时给它们设置相同的 `API_PORT`。

业务代码按功能归档。添加功能时，把对应页面、路由或命令分别放进各应用的 `src/features/<feature>/`。通用 shadcn/ui 组件位于 `apps/web/src/components/ui/`。可以用以下命令添加组件。

```sh
pnpm --filter @best-ts/web exec shadcn add card
```

## 测试

测试分为三层，均不需要预先启动 `pnpm dev`：

| 命令               | 范围                | 说明                                                                      |
| ------------------ | ------------------- | ------------------------------------------------------------------------- |
| `pnpm test`        | API + Web 单元/集成 | API 用 `app.inject` + SQLite 内存库；Web 用 jsdom + Testing Library + MSW |
| `pnpm test:api`    | 仅 API              | 对应 Vitest project `api`                                                 |
| `pnpm test:web`    | 仅 Web              | 对应 Vitest project `web`                                                 |
| `pnpm test:watch`  | 同上，监听模式      | 开发时使用                                                                |
| `pnpm test:cov`    | 同上 + 覆盖率       | 阈值按目录设置（`apps/api/src/features/**`、`apps/web/src/features/**`）  |
| `pnpm test:e2e`    | Playwright E2E      | 默认自动拉起 API + Vite，使用 SQLite 内存库                               |
| `pnpm test:e2e:ui` | Playwright 交互模式 | 本地调试                                                                  |
| `pnpm check`       | 全量门禁            | `format:check` + `lint` + `typecheck` + `test`                            |

测试与源码分离，便于构建保持干净：`apps/api/test/` 和 `apps/web/test/` 按 feature/组件组织，E2E 位于根目录 `e2e/`。新增功能时在对应 `test/features/<feature>/` 下补用例。

E2E 默认是自包含的；也可以通过环境变量直接跑研发/联调环境的真实后端（详细说明见 [e2e/README.md](e2e/README.md)）：

```sh
# 本地（默认）：自动启动 API + Vite，内存库
pnpm test:e2e

# 研发/联调环境：不启动本地服务，读写真实数据
E2E_ALLOW_REMOTE=1 E2E_BASE_URL=https://dev.example.com pnpm test:e2e
```

首次运行前安装浏览器：`pnpm exec playwright install chromium`。网络受限时可复用本机 Chrome：`E2E_BROWSER_CHANNEL=chrome pnpm test:e2e`。

也可以用 Makefile 入口（`E2E_*` 变量支持环境变量或命令行变量透传）：

| Make 目标                                                   | 等价命令                                            | 说明                   |
| ----------------------------------------------------------- | --------------------------------------------------- | ---------------------- |
| `make test`                                                 | `pnpm test`                                         | API + Web 单测/集成    |
| `make test-api` / `make test-web`                           | `pnpm test:api` / `pnpm test:web`                   | 只跑单个项目           |
| `make test-cov`                                             | `pnpm test:cov`                                     | 覆盖率汇总 + lcov/HTML |
| `make coverage-open`                                        | 打开 `coverage/index.html`                          | 查看覆盖率报告         |
| `make check`                                                | `pnpm check`                                        | 全量门禁               |
| `make test-e2e`                                             | `pnpm test:e2e`                                     | 本地 SQLite E2E        |
| `make test-e2e-ui`                                          | `pnpm test:e2e:ui`                                  | E2E 交互调试           |
| `make test-e2e-remote E2E_BASE_URL=https://dev.example.com` | `E2E_ALLOW_REMOTE=1 E2E_BASE_URL=... pnpm test:e2e` | 研发/联调环境 E2E      |

例如网络受限时复用本机 Chrome：`make test-e2e E2E_BROWSER_CHANNEL=chrome`；远程环境如需登录态可追加 `E2E_STORAGE_STATE=...`、`E2E_API_URL=...`。

## 格式化与代码检查

在项目根目录运行以下命令。

| 命令                | 用途                                 |
| ------------------- | ------------------------------------ |
| `pnpm format`       | 用 Prettier 格式化文件并写回         |
| `pnpm format:check` | 检查格式，适合用于 CI                |
| `pnpm lint`         | 用 Oxlint 检查各应用和共享包         |
| `pnpm typecheck`    | 检查各应用和共享包的 TypeScript 类型 |

Prettier 默认使用根目录的 `.prettierrc.json`。需要覆盖时，可以在对应包内通过 `prettier.config.mjs` 导入根配置并覆盖选项。

Oxlint 的公共规则位于根目录的 `.oxlintrc.json`。三个应用通过 `extends` 继承根规则，并按运行环境增加约束。

| 应用配置                      | 规则                                                        |
| ----------------------------- | ----------------------------------------------------------- |
| `apps/web/src/.oxlintrc.json` | 检查 React Hooks 和 JSX 可访问性                            |
| `apps/api/.oxlintrc.json`     | 使用 Fastify logger 记录日志，避免直接调用 `process.exit()` |
| `apps/admin/.oxlintrc.json`   | 允许用 `console` 输出 CLI 结果，使用 ESM 导入               |

`packages/shared` 直接使用根配置。根目录的 `pnpm lint` 会自动发现各应用的配置。

各应用的 `dev`、`build` 和 Admin 的 `build:bin` 会先运行 `check:fix`。Oxlint 应用安全修复，Prettier 写回格式，两者只处理当前 app 的文件。任一工具失败（包括未修复的 lint 警告），该应用的启动或构建会报错停止。

## 类型检查与构建

```sh
pnpm typecheck
pnpm build
pnpm build:web
pnpm build:api
pnpm build:admin
```

`pnpm build` 构建所有 workspace 模块。单独构建某个 app 时，根目录的 `build:<app>` 会先构建它的 workspace 依赖。各模块的产物位于各自的 `dist/` 目录。构建后可从根目录运行 API 和 CLI。

```sh
pnpm --filter @best-ts/api start
pnpm --filter @best-ts/admin start tasks list
```

### Admin 可执行文件

在构建机器安装 Bun，然后从项目根目录运行以下命令。

```sh
pnpm build:admin:bin
./apps/admin/dist/best-ts-admin --help
```

产物自带 Bun 运行时，按构建目标的操作系统和 CPU 架构分发。Windows 产物使用 `.exe` 后缀。CLI 通过 `--api-url` 或 `API_URL` 连接 Fastify API。

## 容器部署

从根目录运行 `make docker-build` 构建 API 和 Web 镜像，或运行 `make compose-up` 构建并启动两个容器。Makefile 也提供开发、测试、应用打包和 Admin 二进制构建入口。Docker Compose、Kubernetes 和镜像配置见 [部署说明](deploy/README.md)。
