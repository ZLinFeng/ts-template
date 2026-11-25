# 部署

API 镜像运行 Fastify，并将 SQLite 保存到 `/data/tasks.sqlite`。Web 镜像使用 Nginx 托管 Vite 的构建产物，将同源的 `/api` 请求转发到 API 服务。

API 镜像包含 `apps/api/config/`。容器内 `NODE_ENV=production`，默认加载 `/app/apps/api/config/config-production.yaml`；`API_HOST`、`API_PORT`、`API_DB_PATH` 环境变量优先于 YAML。Kubernetes 部署可用 ConfigMap 挂载自定义 YAML，并通过 `API_CONFIG_FILE` 指定路径；配置文件中只放非敏感值，密钥和数据库凭据通过环境变量注入。

## 根目录命令

| 目标                                                           | 用途                           |
| -------------------------------------------------------------- | ------------------------------ |
| `make dev`                                                     | 运行三个应用的开发任务         |
| `make dev-web`、`make dev-api`、`make dev-admin ARGS='--help'` | 运行单个应用的开发任务         |
| `make build`                                                   | 构建整个 workspace             |
| `make build-web`、`make build-api`、`make build-admin`         | 构建单个应用及其共享依赖       |
| `make build-admin-bin`                                         | 使用 Bun 生成 Admin 可执行文件 |
| `make docker-build`                                            | 构建 API 和 Web 镜像           |
| `make docker-build-api`、`make docker-build-web`               | 构建单个镜像                   |

两个 Dockerfile 都使用 workspace 根目录作为构建上下文。Makefile 从根 `package.json` 的 `name` 派生 `PROJECT`，默认镜像名为 `$(PROJECT)-api:local` 和 `$(PROJECT)-web:local`。可通过 `PROJECT`、`API_IMAGE` 和 `WEB_IMAGE` 覆盖。

## Docker Compose

在 workspace 根目录运行以下命令。

```sh
make compose-up
curl -fsS http://127.0.0.1:8080/api/health
API_URL=http://127.0.0.1:8080 pnpm admin tasks list
```

Web 默认发布到 `127.0.0.1:8080`，API 通过 Compose 内部网络和 Web 的 `/api` 路由访问。可用 `make compose-up WEB_PORT=18080` 更改对外端口。SQLite 使用名为 `api-data` 的 Compose 卷，`make compose-down` 停止容器并保留该卷。

## Kubernetes

清单位于 `deploy/k8s`，通过 Kustomize 部署到 `best-ts` 命名空间。集群需要能为 PVC 提供 `ReadWriteOnce` 存储。默认使用集群的 StorageClass。

对于共享本地 Docker 镜像的开发集群，先用 `make docker-build` 构建默认镜像。对于其它集群，使用目标仓库的镜像名构建并推送镜像，再在 `deploy/k8s/kustomization.yaml` 的 `images` 中配置对应的 `newName` 和 `newTag`。

```sh
kubectl kustomize deploy/k8s
kubectl apply -k deploy/k8s
kubectl -n best-ts rollout status deployment/api
kubectl -n best-ts rollout status deployment/web
kubectl -n best-ts port-forward service/web 8080:8080
```

在端口转发运行期间，访问 `http://127.0.0.1:8080`，也可用 `curl -fsS http://127.0.0.1:8080/api/health` 验证代理。Web 和 API 均使用 ClusterIP Service。默认 `API_UPSTREAM=api:3000` 依赖两者位于同一命名空间；若把 Web 部署到其他命名空间，请改为 `api.<api-namespace>.svc.cluster.local:3000`，或按集群 DNS 后缀调整。

API 使用单副本和 `Recreate` 更新策略，SQLite 数据由 PVC 持久化。API 更新期间会短暂中断。公开部署任务接口时需要为其配置认证和授权。
