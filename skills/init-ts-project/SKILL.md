---
name: init-ts-project
description: 从 best-ts-template 初始化一个新的 TypeScript 全栈项目。用于从 GitHub 拉取模板，替换项目名、npm scope 和显示名，并完成依赖安装、pnpm check、构建验证。
whenToUse: 用户说“用 best-ts-template 创建项目”“初始化一个 TS 模板项目”“从模板拉一个新项目”时使用。
---

# 初始化 TypeScript 项目

本 skill 把 `best-ts-template` 变成一个新项目：克隆模板、执行模板自带的改名脚本、删除生成器文件、安装依赖，并跑完检查和构建。脚本是唯一入口，不要手工批量替换 `package.json` 或源码 import。

## 1. 先收集参数

向用户确认以下信息；能从上下文推断的直接采用，不确定再问：

- 目标目录：默认 `./<name>`。
- `name`：kebab-case，例如 `acme-app`。会用作根包名、镜像前缀、K8s namespace 和 `<name>-admin` CLI。
- `scope`：npm scope，例如 `@acme`。内部包会变成 `@acme/api`、`@acme/web`、`@acme/admin`、`@acme/shared`。用户没指定时可用 `@<name>`。
- `displayName`：README 标题和网页标题，例如 `Acme App`。用户没指定时用 kebab-case 转 Title Case。

校验：`name` 只能是小写字母/数字/连字符；`scope` 必须以 `@` 开头且小写；目标目录必须不存在或为空。

## 2. 确认模板地址

模板地址按以下优先级解析：

1. 命令的 `--template`；
2. 环境变量 `TS_TEMPLATE_REPO`；
3. 本 skill 目录下 `config.json` 的 `templateRepo`。

模板仓库发布前先填 `config.json`，或运行时传：

```sh
export TS_TEMPLATE_REPO="https://github.com/ZLinFeng/ts-template.git"
```

支持 `owner/repo`、`https://...`、`git@...`、`file://...` 和本地目录路径。本地模板开发时用 `--template /path/to/best-ts-template`。

## 3. 执行脚手架

先确认环境：Node.js >= 24.15、pnpm、git 可用。

```sh
node "<skill_dir>/scripts/scaffold.mjs" \
  --template "$TS_TEMPLATE_REPO" \
  --dir "<target-dir>" \
  --name "<name>" \
  --scope "@<scope>" \
  --display-name "<Display Name>"
```

`<skill_dir>` 是本 skill 的目录，加载 skill 时 `<skill_resources>` 会给出。也可以直接从仓库运行 `skills/init-ts-project/scripts/scaffold.mjs`。

常用变体：

```sh
# 只预览，不写文件
node "<skill_dir>/scripts/scaffold.mjs" --template "$TS_TEMPLATE_REPO" \
  --name acme-app --scope @acme --display-name "Acme App" --dry-run

# 本地模板，跳过安装/检查（只生成文件）
node "<skill_dir>/scripts/scaffold.mjs" --template /path/to/best-ts-template \
  --dir /tmp/acme-app --name acme-app --scope @acme --no-install

# 额外跑 Playwright E2E；需要已安装 Chromium
node "<skill_dir>/scripts/scaffold.mjs" --template "$TS_TEMPLATE_REPO" \
  --name acme-app --scope @acme --e2e
```

## 4. 脚本会做什么

1. 校验参数和目标目录；目标非空时直接失败，不会删除已有文件。
2. 本地模板用 `fs.cp` 复制（跳过 `node_modules`、`dist`、`coverage` 等），远程模板用 `git clone --depth 1`，随后删除模板的 `.git`。
3. 执行模板的 `scripts/init-template.mjs`，完成身份替换并自检包名、Admin bin 和残留标识。
4. 删除 `skills/` 和 `scripts/init-template.mjs`（除非 `--keep-generator`），让生成的项目不携带生成器。
5. `pnpm install` 重新生成 lockfile，然后 `pnpm check`、`pnpm build`。
6. 默认 `git init -b main`，但不自动提交、不配置 remote、不 push。

## 5. 验收标准

只有以下都满足才算完成：

- 命令退出码为 0；
- 目标目录的根 `package.json` 名字等于 `--name`；
- `apps/api`、`apps/web`、`apps/admin`、`packages/shared` 的包名都以 `--scope/` 开头；
- 源码和配置里不存在旧的 `best-ts` / `@best-ts` 标识（生成器目录和 lockfile 除外，lockfile 已由 `pnpm install` 重写）；
- `pnpm check` 通过（Prettier、Oxlint、TypeCheck、Vitest）；
- `pnpm build` 通过；
- 如启用 `--e2e`，`pnpm test:e2e` 通过。

最后向用户报告：目标路径、name/scope/displayName、模板来源、每一步结果、`git status` 状态，以及下一步命令（`cd <dir> && pnpm dev`）。

## 6. 边界与故障处理

- 只从用户确认过的模板地址拉取；不要运行来源不明的模板脚本。
- 不要用 `sudo`；不要自动 `git commit`、`git push` 或创建 GitHub 仓库。
- 目标目录非空、网络失败、`pnpm install` 失败或检查失败时，脚本会保留现场并以非零退出码结束。先读错误日志，不要直接删除目录；把路径和失败步骤报告给用户，再决定重试或清理。
- 如果 `pnpm check` 因模板本身的问题失败，先修模板仓库并重新发布，不要在生成的项目里手工打补丁掩盖问题。
- `--no-install` 只用于快速生成文件；此时必须明确告诉用户尚未安装、检查和构建。
