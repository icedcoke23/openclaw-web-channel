# OpenClaw Web Channel v3.0

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED)](Dockerfile)
[![Version](https://img.shields.io/badge/version-3.0.0-orange)](package.json)

> Web 仪表盘 -- 通过浏览器与 [OpenClaw](https://github.com/openclaw/openclaw) AI 助手网关交互。

## 功能特性

- **实时聊天** -- 流式响应、Markdown 渲染、代码高亮、文件拖拽上传
- **仪表盘** -- 网关状态、频道状态、Cron 任务、活动流、系统资源监控
- **会话管理** -- 创建/切换/重置/压缩/删除会话，查看转录记录
- **配置编辑** -- 表单编辑 + JSON 编辑器，差异预览，验证后保存
- **实时日志** -- SSE 流式推送，级别过滤，文本搜索，导出文件
- **技能管理** -- 查看/启用/禁用已安装技能
- **节点管理** -- 查看已配对节点，执行摄像头/定位/通知操作
- **启动检测** -- 自动检测 OpenClaw 安装状态和 Gateway 运行状态
- **暗色主题** -- 现代深色 UI，中英文支持
- **响应式** -- 适配桌面和移动端
- **安全** -- CSP 防护、后端代理模式、速率限制、Token 认证
- **v3.0 新增** -- 流式超时保护、并发连接保护、版本感知 RPC 适配器、WebSocket 连接数限制、网关版本检测

## 架构

```
+------------------+       +---------------------+       +-------------------+
|                  |  WS   |                     |  WS   |                   |
|   浏览器客户端    |<----->|  OpenClaw Web       |<----->|  OpenClaw Gateway |
|   (React SPA)    |  HTTP |  Channel (本服务)    |       |  (AI 助手后端)     |
|                  |<----->|                     |       |                   |
+------------------+       +---------------------+       +-------------------+
                                  |
                            +-----+-----+
                            |           |
                       +----+----+ +----+----+
                       |  REST   | |  SSE    |
                       |  API    | |  Logs   |
                       +---------+ +---------+
```

**数据流说明：**

1. 浏览器通过 WebSocket (`/ws`) 与本服务建立长连接
2. 本服务作为代理，通过 WebSocket 连接到 OpenClaw Gateway
3. 浏览器也可通过 REST API (`/api/*`) 发起请求
4. 日志通过 SSE (`/api/logs`) 实时推送
5. RPC 适配器层自动处理不同版本 Gateway 的方法名差异

## 快速开始

### 前置要求

- Node.js >= 18
- 运行中的 OpenClaw Gateway（默认端口 18789）

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/openclaw/openclaw-web-channel.git
cd openclaw-web-channel

# 安装后端依赖
npm install

# 构建前端（React SPA）
cd client && npm install && npm run build && cd ..

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 OPENCLAW_GATEWAY_TOKEN

# 启动服务
npm start
```

浏览器打开 `http://localhost:3000` 即可使用。

### 开发模式

```bash
# 后端热重载
npm run dev

# 前端开发服务器（另一个终端）
npm run dev:frontend
```

### 仅构建前端

```bash
npm run build
```

## 配置

### 配置优先级

环境变量 > config.json > 默认值

### config.json

```json
{
  "gatewayUrl": "ws://localhost:18789",
  "gatewayToken": "",
  "port": 3000,
  "host": "0.0.0.0",
  "cors": { "origin": "*" },
  "rateLimit": { "windowMs": 60000, "max": 100 },
  "sessionKey": "webchat:main",
  "reconnect": {
    "initialDelay": 1000,
    "maxDelay": 30000,
    "multiplier": 2
  },
  "maxWebSocketConnections": 50,
  "streamTimeout": 120000
}
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENCLAW_GATEWAY_URL` | Gateway WebSocket URL | `ws://localhost:18789` |
| `OPENCLAW_GATEWAY_TOKEN` | Gateway 认证 Token | 空 |
| `OPENCLAW_API_TOKEN` | API 端点认证 Token（可选） | 空 |
| `PORT` | 服务端口 | `3000` |
| `HOST` | 绑定地址 | `0.0.0.0` |
| `MAX_WS_CONNECTIONS` | 最大 WebSocket 连接数 | `50` |
| `STREAM_TIMEOUT` | 流式响应超时（毫秒） | `120000` |

### 配置项说明

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `gatewayUrl` | string | OpenClaw Gateway 的 WebSocket 地址 |
| `gatewayToken` | string | Gateway 认证令牌 |
| `port` | number | HTTP 服务监听端口 |
| `host` | string | HTTP 服务绑定地址 |
| `cors.origin` | string | CORS 允许的来源，`*` 表示允许所有 |
| `rateLimit.windowMs` | number | 速率限制时间窗口（毫秒） |
| `rateLimit.max` | number | 时间窗口内最大请求数 |
| `sessionKey` | string | 默认会话标识 |
| `reconnect.initialDelay` | number | 初始重连延迟（毫秒） |
| `reconnect.maxDelay` | number | 最大重连延迟（毫秒） |
| `reconnect.multiplier` | number | 重连延迟倍数（指数退避） |
| `maxWebSocketConnections` | number | 最大浏览器 WebSocket 连接数 |
| `streamTimeout` | number | 流式响应超时时间（毫秒） |

## API 文档

### REST API

#### 基础

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/health` | 本地健康检查（无需认证） |
| `GET` | `/api/gateway/version` | Gateway 版本信息 |
| `GET` | `/api/status` | Gateway 连接状态 |
| `GET` | `/api/dashboard` | 聚合仪表盘数据 |

#### 聊天

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/history?session=xxx&limit=50` | 聊天历史 |
| `POST` | `/api/chat` | 发送消息 |
| `POST` | `/api/abort` | 停止生成 |
| `POST` | `/api/inject` | 注入助手文本 |

**POST /api/chat 请求体：**

```json
{
  "message": "你好",
  "sessionKey": "webchat:main",
  "model": "gpt-4",
  "thinking": false
}
```

#### 会话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/sessions` | 会话列表 |
| `POST` | `/api/sessions` | 创建会话 |
| `PATCH` | `/api/sessions/:key` | 修改会话配置 |
| `POST` | `/api/sessions/:key/reset` | 重置会话 |
| `POST` | `/api/sessions/:key/compact` | 压缩会话上下文 |
| `DELETE` | `/api/sessions/:key` | 删除会话 |
| `GET` | `/api/sessions/:key/transcript` | 会话转录 |

#### 配置

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/config` | 获取配置 |
| `PATCH` | `/api/config` | 修改配置 |
| `GET` | `/api/config/schema` | 配置 Schema |

#### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/models` | 模型列表 |
| `GET` | `/api/channels` | 频道状态 |
| `GET` | `/api/health` | Gateway 健康检查 |
| `GET` | `/api/skills` | 技能列表 |
| `PATCH` | `/api/skills/:name` | 启用/禁用技能 |
| `GET` | `/api/nodes` | 节点列表 |
| `POST` | `/api/nodes/:id/action` | 节点操作 |
| `GET` | `/api/cron` | 定时任务列表 |
| `POST` | `/api/cron/:id/run` | 运行定时任务 |
| `PATCH` | `/api/cron/:id` | 修改定时任务 |
| `GET` | `/api/logs` | 日志流 (SSE) |
| `POST` | `/api/upload` | 文件上传 |
| `GET` | `/api/uploads/:filename` | 获取上传文件 |

### WebSocket API

连接地址：`ws://localhost:3000/ws`

#### RPC 请求

```json
{ "id": "1", "method": "chat.send", "params": { "message": "你好" } }
```

#### RPC 响应

```json
{ "type": "response", "id": "1", "result": { ... } }
```

#### 事件推送

```json
{ "type": "event", "event": "chat", "data": { "text": "...", "done": false } }
```

#### 心跳

```json
// 客户端发送
{ "type": "ping" }

// 服务端响应
{ "type": "pong" }
```

#### 支持的 WebSocket RPC 方法

所有 REST API 对应的 Gateway RPC 方法均可通过 WebSocket 调用，包括：

- `chat.send` / `chat.history` / `chat.abort` / `chat.inject`
- `sessions.list` / `sessions.patch` / `sessions.reset` / `sessions.compact` / `sessions.delete`
- `config.get` / `config.patch` / `config.schema.lookup`
- `models.list`
- `skills.list` / `skills.patch` / `skills.enable` / `skills.disable`
- `node.list` / `node.invoke` / `nodes.list` / `nodes.action`
- `channels.status`
- `health`
- `cron.list` / `cron.run` / `cron.patch`
- `logs.tail`
- `status`

## Docker 部署

### 单独构建运行

```bash
docker build -t openclaw-web .
docker run -d -p 3000:3000 \
  -e OPENCLAW_GATEWAY_URL=ws://host.docker.internal:18789 \
  -e OPENCLAW_GATEWAY_TOKEN=your-token \
  openclaw-web
```

### Docker Compose（含 Gateway）

```bash
# 1. 设置 Token
export OPENCLAW_GATEWAY_TOKEN=your-token

# 2. 启动所有服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f openclaw-web

# 4. 停止服务
docker-compose down

# 5. 停止并清除数据
docker-compose down -v
```

### Docker 健康检查

容器内置健康检查，每 30 秒检测一次 `/health` 端点：

```bash
# 查看容器健康状态
docker inspect --format='{{.State.Health.Status}}' openclaw-web-channel
```

## PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start server.js --name openclaw-web

# 查看状态
pm2 status

# 查看日志
pm2 logs openclaw-web

# 设置开机自启
pm2 startup
pm2 save
```

### PM2 生态配置文件 (ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'openclaw-web',
    script: 'server.js',
    cwd: '/opt/openclaw-web-channel',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '0.0.0.0',
    },
  }],
};
```

## systemd 部署

创建 `/etc/systemd/system/openclaw-web.service`：

```ini
[Unit]
Description=OpenClaw Web Channel v3.0
After=network.target

[Service]
Type=simple
User=openclaw
Group=openclaw
WorkingDirectory=/opt/openclaw-web-channel
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=OPENCLAW_GATEWAY_URL=ws://localhost:18789
Environment=OPENCLAW_GATEWAY_TOKEN=your-token
Environment=PORT=3000
Environment=HOST=0.0.0.0

[Install]
WantedBy=multi-user.target
```

```bash
# 创建用户
sudo useradd -r -s /bin/false openclaw
sudo chown -R openclaw:openclaw /opt/openclaw-web-channel

# 启用并启动
sudo systemctl daemon-reload
sudo systemctl enable --now openclaw-web

# 查看状态
sudo systemctl status openclaw-web

# 查看日志
sudo journalctl -u openclaw-web -f
```

## 安全建议

### 生产环境清单

1. **设置 Gateway Token**
   ```bash
   export OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
   ```

2. **设置 API Token**（保护 `/api/*` 端点）
   ```bash
   export OPENCLAW_API_TOKEN=$(openssl rand -hex 32)
   ```

3. **限制 CORS 来源**
   ```json
   { "cors": { "origin": "https://your-domain.com" } }
   ```

4. **限制绑定地址**
   ```json
   { "host": "127.0.0.1" }
   ```

5. **使用 HTTPS 反向代理**（Nginx / Caddy）

6. **配置防火墙**，仅开放必要端口

### Nginx 反向代理配置

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # 前端静态资源
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 代理
    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # SSE 日志流
    location /api/logs {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
}
```

### CSP 策略

v3.0 默认启用 Content Security Policy：

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
connect-src 'self' ws: wss:;
font-src 'self';
```

如需自定义，可在反向代理层覆盖 CSP 头。

## 故障排除

### 连接不上 Gateway

1. 确认 Gateway 正在运行：`openclaw gateway status`
2. 检查 `gatewayUrl` 是否正确（注意端口和协议 `ws://` vs `wss://`）
3. 确认 `gatewayToken` 已正确配置
4. 检查防火墙是否放行 18789 端口
5. 查看服务日志中的连接错误信息

### 聊天无响应

1. 检查 Gateway 日志：`openclaw gateway logs`
2. 确认 Gateway 已配置 AI 模型
3. 检查是否触发速率限制（默认 100 请求/分钟）
4. 检查流式超时设置（默认 120 秒）

### WebSocket 频繁断开

1. 如使用反向代理，确保已配置 WebSocket 支持（参见上方 Nginx 配置）
2. 检查 `proxy_read_timeout` 是否足够长
3. 检查网络稳定性
4. 客户端会自动重连（指数退避，最大 30 秒）

### 流式响应中断

1. v3.0 新增 120 秒流式超时保护，超时后自动中止
2. 可通过 `STREAM_TIMEOUT` 环境变量调整超时时间
3. 客户端断开后会自动清理 pending 的聊天请求

### 连接数超限

1. v3.0 默认限制 50 个 WebSocket 连接
2. 可通过 `MAX_WS_CONNECTIONS` 环境变量调整
3. 超限时新连接会收到 `1013` 关闭码

### 消息被截断

Gateway 的 `chat.history` 可能会截断大消息。如需完整历史，请查看 Gateway 日志。

### RPC 方法不存在

v3.0 内置版本感知 RPC 适配器，自动尝试多种方法名变体：
- `sessions.reset` -> `sessions.patch` (带 reset 标志)
- `sessions.compact` -> `sessions.patch` (带 compact 标志)
- `node.list` -> `nodes.list`
- `config.schema.lookup` -> `config.schema`

如仍有问题，请检查 Gateway 版本是否兼容。

## 项目结构

```
openclaw-web-channel/
├── server.js              # Express + WebSocket 服务端（后端核心）
├── config.json            # 运行配置
├── package.json           # 项目元数据与依赖
├── .env.example           # 环境变量模板
├── .gitignore             # Git 忽略规则
├── .dockerignore          # Docker 忽略规则
├── Dockerfile             # 多阶段 Docker 构建
├── docker-compose.yml     # Docker Compose 编排（含 Gateway）
├── LICENSE                # MIT 许可证
├── README.md              # 本文档
├── uploads/               # 上传文件目录（运行时创建）
└── client/                # React 前端（独立子项目）
    ├── package.json
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── components/
    │   ├── pages/
    │   └── hooks/
    ├── public/
    └── dist/              # 构建产物（npm run build 生成）
```

## v3.0 更新日志

### 新增功能

- **流式超时保护**：120 秒（可配置）流式响应超时，自动中止挂起的聊天请求
- **并发连接保护**：Gateway WebSocket 连接状态检查，防止重复连接
- **CSP 防护**：启用 Content Security Policy，限制资源加载来源
- **版本感知 RPC 适配器**：自动尝试多种方法名，兼容不同版本 Gateway
- **WebSocket 连接数限制**：默认 50 个，超限拒绝新连接
- **网关版本检测**：连接后自动检测并记录 Gateway 版本
- **`/api/gateway/version` 端点**：查询 Gateway 版本信息

### 变更

- 前端从单体 `public/index.html` 迁移到 React SPA (`client/`)
- `marked`、`highlight.js`、`dompurify` 从后端依赖移至前端
- `express-rate-limit` 改为 `helmet` 内置依赖方式
- 新增 `dev:frontend`、`build` npm scripts
- Dockerfile 改为多阶段构建（前端构建 + 后端构建 + 生产镜像）

### 修复

- WebSocket 断开时清理 streaming 状态
- 防止 `connect()` 在已有连接时重复创建
- 优雅关闭时清理所有客户端流式状态

## 贡献指南

欢迎贡献！请遵循以下流程：

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'Add your feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

### 开发规范

- 后端代码遵循现有风格（2 空格缩进，JSDoc 注释）
- 前端使用 React + TypeScript
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范
- 确保所有现有测试通过

## 许可证

[MIT License](LICENSE)
