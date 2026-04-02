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

采用**模块化单体架构**：
- `src/client/` - 前端代码（浏览器运行）
- `src/server/` - 后端代码（Node.js）
- `src/shared/` - 共享类型和常量

```
src/
├── client/           # 前端：组件、状态管理、API 客户端
│   ├── components/   # UI 组件
│   │   ├── layout/   # 布局组件 (AppLayout, TopBar, BottomMenu, Sidebar)
│   │   ├── chat/     # 聊天组件 (MessageList, InputArea)
│   │   └── files/    # 文件浏览器组件
│   ├── stores/       # Zustand 状态管理
│   └── services/     # API 和 WebSocket 服务
├── server/           # 后端：Express 路由、控制器、业务逻辑
│   ├── session/      # 会话管理 (GatewaySession)
│   └── routes/       # API 路由
└── shared/           # 共享：API 契约类型
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

## 文档

| 文档 | 说明 |
|------|------|
| [README.md](./README.md) | 项目概述和快速开始（本文档） |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 开发指南、架构说明、API 参考、代码规范 |
| [FEATURES.md](./FEATURES.md) | 功能规格书（界面布局、功能清单） |
| [AGENTS.md](./AGENTS.md) | AI 助手指令和开发规则 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本变更历史 |
| [docs/ERROR_HANDLING.md](./docs/ERROR_HANDLING.md) | 错误处理最佳实践 |

### 快速开发规范

- **组件**: 函数组件 + Hooks，不超过 200 行
- **状态**: Zustand 管理，使用 Selector 订阅局部状态
- **结构**: `app/` → `features/` → `shared/` → `pages/`
- **命名**: 组件 PascalCase，Hooks `use` 开头，Store `*Store`
- **性能**: 大数据用虚拟滚动，缓存用 useMemo/useCallback

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
