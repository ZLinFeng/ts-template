.DEFAULT_GOAL := build

PNPM ?= pnpm
DOCKER ?= docker
PROJECT ?= $(shell node -p "require('./package.json').name")
API_IMAGE ?= $(PROJECT)-api:local
WEB_IMAGE ?= $(PROJECT)-web:local
WEB_PORT ?= 8080
E2E_BASE_URL ?=

COMPOSE = COMPOSE_PROJECT_NAME="$(PROJECT)" API_IMAGE="$(API_IMAGE)" WEB_IMAGE="$(WEB_IMAGE)" WEB_PORT="$(WEB_PORT)" $(DOCKER) compose -f deploy/docker-compose.yml

UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
OPEN ?= open
else
OPEN ?= xdg-open
endif

.PHONY: dev dev-web dev-api dev-admin build build-web build-api build-admin build-admin-bin \
        test test-api test-web test-cov coverage-open check test-e2e test-e2e-ui test-e2e-remote \
        docker-build docker-build-api docker-build-web compose-up compose-down

dev:
	$(PNPM) dev

dev-web:
	$(PNPM) dev:web

dev-api:
	$(PNPM) dev:api

dev-admin:
	$(PNPM) dev:admin $(ARGS)

build:
	$(PNPM) build

build-web:
	$(PNPM) build:web

build-api:
	$(PNPM) build:api

build-admin:
	$(PNPM) build:admin

build-admin-bin:
	$(PNPM) build:admin:bin

test:
	$(PNPM) test

test-api:
	$(PNPM) test:api

test-web:
	$(PNPM) test:web

# API + Web 单测/集成测试，并输出覆盖率汇总、coverage/lcov.info 与 HTML 报告
test-cov:
	$(PNPM) test:cov

# 在浏览器中打开上一次覆盖率 HTML 报告
coverage-open:
	$(OPEN) coverage/index.html

# 全量门禁：格式检查 + lint + typecheck + 测试
check:
	$(PNPM) check

# 本地 E2E：自动拉起 API + Vite，SQLite 内存库
# 网络受限时可复用本机 Chrome：make test-e2e E2E_BROWSER_CHANNEL=chrome
test-e2e:
	$(PNPM) test:e2e

test-e2e-ui:
	$(PNPM) test:e2e:ui

# 研发/联调环境 E2E：不启动本地服务，直接读写目标环境真实数据
# 用法：make test-e2e-remote E2E_BASE_URL=https://dev.example.com
# 可选透传：E2E_API_URL、E2E_STORAGE_STATE、E2E_BROWSER_CHANNEL
test-e2e-remote:
	@if [ -z "$(E2E_BASE_URL)" ]; then \
		echo "用法: make test-e2e-remote E2E_BASE_URL=https://dev.example.com"; \
		exit 1; \
	fi
	E2E_ALLOW_REMOTE=1 E2E_BASE_URL="$(E2E_BASE_URL)" $(PNPM) test:e2e

docker-build: docker-build-api docker-build-web

docker-build-api:
	$(DOCKER) build -f deploy/api/Dockerfile -t "$(API_IMAGE)" .

docker-build-web:
	$(DOCKER) build -f deploy/web/Dockerfile -t "$(WEB_IMAGE)" .

compose-up:
	$(COMPOSE) up --build --wait

compose-down:
	$(COMPOSE) down
