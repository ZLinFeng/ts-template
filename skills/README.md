# Skills

## init-ts-project

从本仓库初始化一个新的 TypeScript 项目。skill 会读取模板地址、克隆仓库、执行改名脚本，并完成 `pnpm install`、`pnpm check`、`pnpm build`。

安装到 DSH 用户级 skill 目录：

```sh
mkdir -p ~/.dsh/skills
cp -R skills/init-ts-project ~/.dsh/skills/
```

首次使用前，在 `~/.dsh/skills/init-ts-project/config.json` 中填写模板仓库，或设置环境变量：

```json
{
  "templateRepo": "https://github.com/<owner>/best-ts-template.git",
  "branch": "main"
}
```

```sh
export TS_TEMPLATE_REPO="https://github.com/<owner>/best-ts-template.git"
```

然后在任意目录运行：

```sh
node ~/.dsh/skills/init-ts-project/scripts/scaffold.mjs \
  --name acme-app \
  --scope @acme \
  --display-name "Acme App"
```

本地开发模板时可以直接指向当前目录：

```sh
node skills/init-ts-project/scripts/scaffold.mjs \
  --template . \
  --dir /tmp/acme-app \
  --name acme-app \
  --scope @acme \
  --display-name "Acme App"
```
