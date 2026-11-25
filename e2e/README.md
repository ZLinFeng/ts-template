# E2E 测试

Playwright 覆盖「Web ↔ API」的关键用户旅程。默认是自包含模式：自动拉起本地 API + Vite，使用 SQLite 内存库，跑完即销毁。也可以通过环境变量切换到研发/联调环境，用真实后端数据跑同一套用例。

## 本地（默认）

```sh
pnpm test:e2e        # 无头执行
pnpm test:e2e:ui     # 交互模式
```

- API：`http://127.0.0.1:3100`，`API_DB_PATH=:memory:`
- Web：`http://127.0.0.1:5273`（Vite 代理 `/api` 到上面的 API）
- 端口可用 `E2E_API_PORT` / `E2E_WEB_PORT` 覆盖，避免和本地 dev 冲突

首次运行需要安装浏览器：

```sh
pnpm exec playwright install chromium
```

如果网络受限（下载 Chromium 慢/失败），可以复用本机 Chrome：

```sh
E2E_BROWSER_CHANNEL=chrome pnpm test:e2e
```

## 研发/联调环境（真实后端）

```sh
E2E_ALLOW_REMOTE=1 \
E2E_BASE_URL=https://dev.example.com \
pnpm test:e2e
```

设置 `E2E_BASE_URL` 后不再启动本地 webServer，直接访问该环境。`E2E_ALLOW_REMOTE=1` 是防误操作开关：远程模式会读写真实数据库，必须显式确认。

| 变量                            | 默认              | 说明                                              |
| ------------------------------- | ----------------- | ------------------------------------------------- |
| `E2E_BASE_URL`                  | 空（本地模式）    | 目标 Web 地址；设置后进入远程模式                 |
| `E2E_ALLOW_REMOTE`              | 空                | 远程模式必须为 `1`，否则配置阶段直接报错          |
| `E2E_API_URL`                   | 同 `E2E_BASE_URL` | Web 与 API 不同源时单独指定 API origin            |
| `E2E_STORAGE_STATE`             | 空                | 需要登录态时传入 Playwright storageState 文件路径 |
| `E2E_BROWSER_CHANNEL`           | 空（Chromium）    | 已安装的浏览器通道，如 `chrome`                   |
| `E2E_API_PORT` / `E2E_WEB_PORT` | `3100` / `5273`   | 仅本地模式生效                                    |

## 数据隔离与安全

- 每个用例生成唯一 `runId` 前缀，所有创建的数据都带该前缀；
- 用例结束自动按前缀清理本次运行创建的任务，不依赖清空整库；
- 断言只针对本用例的数据，不断言全局数量，避免真实环境中其他数据干扰；
- 默认 `workers: 1`，避免共享数据库下的写冲突；
- **不要指向生产环境**。远程模式只应在研发/联调环境使用。

## 目录

```
playwright.config.ts     # 双 webServer / 远程切换 / 浏览器通道
e2e/
├── support/
│   ├── api.ts           # 造数据 helper
│   └── fixtures.ts      # api 请求上下文、runId 与自动清理
└── tests/
    ├── tasks.spec.ts    # 创建 / 完成 / 删除 / 校验
    └── refresh.spec.ts  # API 造数据 → 页面刷新可见
```
