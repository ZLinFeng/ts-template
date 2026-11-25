FROM node:24.19.0-bookworm-slim AS workspace

ENV CI=true
WORKDIR /workspace
RUN npm install --global pnpm@11.20.0

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

FROM workspace AS build

RUN pnpm --filter . --filter ./apps/api... install --frozen-lockfile
COPY tsconfig.base.json .gitignore .oxlintrc.json .prettierrc.json .prettierignore ./
COPY scripts ./scripts
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared
RUN pnpm build:api

FROM workspace AS production-dependencies

RUN pnpm --filter ./apps/api... install --prod --frozen-lockfile

FROM node:24.19.0-bookworm-slim AS runtime

ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=3000 \
    API_DB_PATH=/data/tasks.sqlite
WORKDIR /app
COPY --from=production-dependencies /workspace/ ./
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --chown=node:node --from=build /workspace/apps/api/config ./apps/api/config
COPY --from=build /workspace/packages/shared/dist ./packages/shared/dist
RUN mkdir /data && chown node:node /data

USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.API_PORT+'/api/health').then(r=>{if(!r.ok)process.exitCode=1},()=>{process.exitCode=1})"]
CMD ["node", "apps/api/dist/index.js"]
