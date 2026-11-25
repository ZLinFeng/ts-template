FROM node:24.19.0-bookworm-slim AS build

ENV CI=true
WORKDIR /workspace
RUN npm install --global pnpm@11.20.0

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm --filter . --filter ./apps/web... install --frozen-lockfile

COPY tsconfig.base.json .gitignore .oxlintrc.json .prettierrc.json .prettierignore ./
COPY scripts ./scripts
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
RUN pnpm build:web

FROM nginxinc/nginx-unprivileged:1.30-alpine AS runtime

ENV API_UPSTREAM=api:3000 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    NGINX_ENVSUBST_FILTER="^(API_UPSTREAM|NGINX_LOCAL_RESOLVERS)$"
COPY --from=build /workspace/apps/web/dist/ /usr/share/nginx/html/
COPY deploy/web/default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
