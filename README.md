# Pi Gateway

Pi Coding Agent 的 Web 网关，提供美观的 AI 聊天界面和文件管理功能。

**技术栈**: React 19 + TypeScript + Vite (前端) | Node.js + Express + TypeScript (后端)

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/3280382/pi-gateway-standalone.git
cd pi-gateway-standalone

# 安装依赖
npm install

# 启动开发服务器
bash dev-start.sh
```

访问: http://127.0.0.1:5173 (前端) | http://127.0.0.1:3000 (后端)

## 项目架构

采用**模块化单体架构 (Modular Monolith)**：

```
src/
├── client/                 # 前端：组件、状态管理、API 客户端
│   ├── app/                # 🎯 应用根层
│   │   ├── App.tsx         # 根组件
│   │   ├── Footer.tsx      # 底部视图切换
│   │   ├── LayoutContext/  # 全局布局状态
│   │   └── pages/          # ErrorScreen, LoadingScreen
│   │
│   ├── features/           # 📦 功能域（完全自包含）
│   │   ├── chat/           # 💬 聊天功能
│   │   │   ├── components/     # ChatPanel, InputArea, MessageList...
│   │   │   ├── sidebar/        # SidebarPanel, Sessions, Settings...
│   │   │   ├── stores/         # chatStore, sidebarStore, searchStore...
│   │   │   ├── services/       # chatApi, sidebarApi...
│   │   │   ├── controllers/    # chat.controller
│   │   │   ├── hooks/          # useChat
│   │   │   └── types/          # chat, sidebar
│   │   │
│   │   └── files/          # 📁 文件功能
│   │       ├── components/     # FileBrowser, FileGrid...
│   │       ├── stores/         # fileStore, fileViewerStore
│   │       ├── services/       # fileApi
│   │       └── hooks/          # useDragDrop, useGesture
│   │
│   ├── shared/             # 🔧 全局共享（最少必要）
│   │   ├── ui/                 # Button, Input, Select...
│   │   ├── stores/             # sessionStore
│   │   ├── services/           # websocket.service, base.service...
│   │   ├── controllers/        # file.controller, session.controller
│   │   ├── hooks/              # useAppInitialization, useChatMessages...
│   │   └── types/              # 全局类型定义
│   │
│   ├── lib/                # 工具库 (debug, logger, utils)
│   └── hooks/index.ts      # 兼容性入口
│
├── server/                 # 🖥️ 后端代码 - Feature-Based 架构
│   ├── app/
│   │   ├── registerRoutes.ts   # HTTP 路由注册
│   │   └── registerWS.ts       # WebSocket 处理器注册入口
│   │
│   ├── features/
│   │   ├── chat/ws/            # Chat WebSocket 处理器
│   │   │   ├── prompt.ts
│   │   │   ├── abort.ts
│   │   │   ├── steer.ts
│   │   │   └── ...
│   │   │
│   │   ├── session/ws/         # Session WebSocket 处理器
│   │   │   ├── init.ts
│   │   │   ├── change-dir.ts
│   │   │   └── ...
│   │   │
│   │   └── files/              # Files Feature
│   │
│   ├── core/
│   │   └── session/
│   │       ├── GatewaySession.ts   # 核心会话类
│   │       └── utils.ts
│   │
│   ├── shared/
│   │   └── websocket/
│   │       ├── ws-router.ts    # WebSocket 路由器
│   │       └── types.ts
│   │
│   ├── controllers/        # HTTP 控制器（逐步迁移到 features）
│   ├── lib/                # 工具库
│   ├── llm/                # LLM 日志和拦截器
│   ├── config/             # 配置
│   └── server.ts           # 服务器入口
│
└── shared/                 # 🔗 共享类型（前后端共用）
    └── types/
        ├── api.types.ts
        ├── chat.types.ts
        ├── file.types.ts
        └── websocket.types.ts

已删除的目录:
- stores/, services/, controllers/, types/ → 合并到 features/ 或 shared/
- core/, models/ → 已移除（前端）
- server/routes/, server/middleware/, server/services/ → 已移除（后端）
```

## 核心特性

### 1. 统一布局系统 (AppLayout)
- **顶部菜单**: 模型选择、Thinking 级别、工作目录、搜索
- **侧边栏**: 可隐藏，显示最近工作区、会话列表、设置
- **底部菜单**: 视图切换 (Chat/Files)、侧边栏控制
- **底部面板**: 可弹出的终端/预览面板

### 2. 状态持久化
- **localStorage**: 保存当前工作目录、会话 ID、模型选择
- **服务端会话**: WebSocket 断开后自动保存，重连后恢复

### 3. 双视图模式
- **Chat 视图**: AI 聊天、消息历史、流式响应
- **Files 视图**: 文件浏览、编辑、执行

### 4. 工作目录与 Session 管理
```
工作目录 (currentDir)  →  pi 进程的工作目录
Session 文件          →  持久化的会话历史
PID                   →  动态进程号
```
切换工作目录时：终止当前 pi → 在新目录启动新 pi → 加载对应 session

### 5. 后端 Feature-Based 架构

**WebSocket 消息路由系统** (`shared/websocket/ws-router.ts`):
```typescript
// 之前: server.ts 中的巨型 switch/case
// 之后: 使用 Router 分发
await wsRouter.dispatch(type, ctx, payload);
```

**处理器组织** (`features/*/ws/*.ts`):
- 每个消息类型一个文件
- 单一职责
- 自动注册

## 文档

| 文档 | 说明 |
|------|------|
| [README.md](./README.md) | 项目概述和快速开始（本文档） |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 开发指南、架构说明、API 参考、代码规范 |
| [FEATURES.md](./FEATURES.md) | 功能规格书（界面布局、功能清单） |
| [LEARNING_GUIDE.md](./LEARNING_GUIDE.md) | 系统设计与学习指南 |
| [AGENTS.md](./AGENTS.md) | AI 助手指令和开发规则 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本变更历史 |
| [docs/ERROR_HANDLING.md](./docs/ERROR_HANDLING.md) | 错误处理最佳实践 |
| [REFACTOR_SUMMARY.md](./REFACTOR_SUMMARY.md) | 后端架构重构摘要 |

### 快速开发规范

- **组件**: 函数组件 + Hooks，不超过 200 行
- **状态**: Zustand 管理，使用 Selector 订阅局部状态
- **结构**: `app/` → `features/` → `shared/` → `pages/`
- **命名**: 组件 PascalCase，Hooks `use` 开头，Store `*Store`
- **性能**: 大数据用虚拟滚动，缓存用 useMemo/useCallback
- **后端**: Feature-Based 架构，WebSocket 使用 Router 分发

详见 [DEVELOPMENT.md](./DEVELOPMENT.md) 完整规范。

## 常用命令

```bash
# 开发
npm run dev              # 启动开发服务器
bash scripts/start-tmux-dev.sh  # Tmux 3-pane 模式

# 构建与检查
npm run build            # 生产构建
npm run check            # 代码检查 (Biome + TypeScript)

# 测试
npm test                 # 运行所有测试
npm run test:unit        # 单元测试
npm run test:e2e         # E2E 测试

# 服务管理
node scripts/tmux-controller.js status    # 查看服务状态
node scripts/tmux-controller.js restart-frontend  # 重启前端
```

## 环境变量

```bash
# 开发环境
VITE_API_URL=http://127.0.0.1:3000
PORT=3000

# 可选: 调试模式
DEBUG=true
```

## 浏览器支持

- Chrome/Edge 90+
- Firefox 90+
- Safari 15+

## 与 Monorepo 的关系

本项目是从 pi-mono monorepo 独立出来的 Gateway 项目。

| 特性 | Standalone | Monorepo |
|------|------------|----------|
| 依赖管理 | npm 直接安装 | workspace 链接 |
| 版本管理 | 独立 | 统一 |
| 部署 | 独立部署 | 集成部署 |

### 本地包开发调试

如需从本地 monorepo 链接包：

```bash
cd /path/to/pi-mono/packages/coding-agent
npm link
cd /path/to/pi-gateway-standalone
npm link @mariozechner/pi-coding-agent
```

## 许可证

MIT
