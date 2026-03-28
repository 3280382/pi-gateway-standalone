# 开发指南

## 快速开始 (推荐: Tmux 三窗格模式)

```bash
bash scripts/start-tmux-dev.sh
```

这会在一个 tmux 会话中创建三个窗格：
- **上左**: 前端服务 (http://127.0.0.1:5173)
- **上右**: 后端服务 (http://127.0.0.1:3000)
- **底部**: AI 交互窗格（AI 在此执行命令）

快捷键:
- `Ctrl+b + ↑/↓/←/→` - 切换窗格
- `Ctrl+b + d` - 分离会话（后台继续运行）

### 传统启动方式

```bash
bash dev-start.sh  # 非 tmux，直接在后台运行
```

## 项目架构

本项目采用**模块化单体架构 (Modular Monolith)**，前后端代码在同一仓库，但严格分离。

```
src/
├── client/              # 🎨 前端代码（浏览器运行）
│   ├── components/      # React 组件
│   ├── stores/          # Zustand 状态管理
│   ├── services/        # 前端 API 服务
│   │   └── api/         # API 客户端
│   ├── controllers/     # 前端业务控制器
│   ├── hooks/           # React hooks
│   ├── models/          # 数据模型
│   ├── lib/             # 前端工具
│   ├── types/           # 前端私有类型
│   ├── styles/          # 全局样式
│   ├── mocks/           # Mock 数据
│   ├── main.tsx         # 入口
│   └── App.tsx          # 根组件
│
├── server/              # 🖥️ 后端代码（Node.js）
│   ├── routes/          # Express 路由
│   ├── controllers/     # 后端控制器
│   ├── middleware/      # 中间件
│   ├── services/        # 后端业务逻辑
│   ├── session/         # 会话管理
│   ├── llm/             # LLM 拦截器、日志
│   ├── lib/             # 后端工具、错误处理
│   ├── config/          # 配置
│   ├── types/           # 后端私有类型
│   └── server.ts        # 服务器入口
│
└── shared/              # 🔗 共享代码（仅类型/常量）
    ├── types/           # API 契约类型
    └── constants/       # 常量
```

## 架构边界规则

### ❌ 禁止跨边界导入

| 错误示例 | 说明 |
|---------|------|
| `client/` 导入 `@server/*` | 前端不能直接使用后端代码 |
| `server/` 导入 `@client/*` | 后端不能直接使用前端代码 |
| `client/` 使用 Node.js 模块 (`fs`, `path`) | 浏览器环境不支持 |
| `shared/` 包含运行时逻辑 | 只能有类型和常量 |

### ✅ 正确的交互方式

```typescript
// 前端调用后端 API（正确）
// client/services/api/chatApi.ts
import { fetchApi } from './client';
export const chatApi = {
  sendMessage: (msg: string) => fetchApi('/api/chat', { body: { message: msg } })
};

// 后端提供 API（正确）
// server/routes/index.ts
app.post('/api/chat', chatController.sendMessage);
```

## 路径别名

```typescript
// 前端代码
import { Button } from '@/components/ui/Button';
import { useChatStore } from '@/stores/chatStore';
import type { Message } from '@/models/message.model';

// 后端代码
import { GatewaySession } from '@server/session/gateway-session';
import { llmInterceptor } from '@server/llm/interceptor';

// 共享代码
import type { ApiResponse } from '@shared/types/api.types';
import { APP_NAME } from '@shared/constants/app';
```

## 常用脚本

```bash
npm run dev              # 后端热重载
npm run dev:react        # 前端 Vite
npm run build            # 生产构建
npm run typecheck        # 类型检查
npm run check            # 代码检查（Biome + ESLint）
```

## 测试

```bash
npm test                 # 运行单元测试 + 集成测试
npm run test:unit        # 仅单元测试
npm run test:integration # 仅集成测试
npm run test:e2e         # E2E 测试
npm run test:debug       # 调试测试
```

### 测试目录结构

```
test/
├── unit/                # 单元测试
│   ├── client/          # 前端单元测试
│   ├── server/          # 后端单元测试
│   └── models/          # 模型单元测试
├── integration/         # 集成测试
│   ├── client/          # 前端集成测试
│   └── server/          # 后端集成测试
└── e2e/                 # 端到端测试
```

## 开发规范

### 文件命名
- 组件: `PascalCase.tsx` (如 `ChatPanel.tsx`)
- 样式: `Component.module.css`
- 工具: `camelCase.ts`
- 类型: `types.ts` 或 `*.types.ts`

### 代码规范
- TypeScript 严格模式
- CSS Modules 管理样式
- Zustand 状态管理
- 统一使用路径别名（@/, @shared/, @server/）

### 提交规范

```
type(scope): subject

类型: feat, fix, docs, style, refactor, test, chore
```

示例:
```
feat(chat): add message search

Add search functionality to chat panel
```

## ESLint 规则

项目配置了跨边界导入检查：
- Client 代码不能导入 `@server/*`
- Server 代码不能导入 `@client/*`
- 违反规则会在编辑器中显示错误

## 开发流程管理 (Tmux 方案)

### 三窗格架构（上1/3、下2/3）

```
┌───────────────────────┬───────────────────────┐
│  🎨 前端窗格 (0)       │  🖥️  后端窗格 (1)       │  <- 上部 33%
│  npx vite             │  npx tsx watch        │     左右各50%
│  http://127.0.0.1:5173│  http://127.0.0.1:3000│
├───────────────────────┴───────────────────────┤
│  🤖 AI 交互窗格 (2) - pi                        │  <- 底部 66%
│  AI 在此执行命令、查看日志、自动修复            │     宽度占满
└───────────────────────────────────────────────┘
```

### AI 自动化控制

AI 现在可以**直接控制**服务，无需用户手动操作：

```bash
# AI 使用的控制命令
node scripts/tmux-controller.js status           # 检查状态
node scripts/tmux-controller.js restart-frontend # 重启前端
node scripts/tmux-controller.js restart-backend  # 重启后端
node scripts/tmux-controller.js clear-cache      # 清缓存
node scripts/tmux-controller.js autofix          # 自动修复所有问题
```

### 用户观察视角

1. **启动**: `bash scripts/start-tmux-dev.sh`
2. **观察**: 你会看到三个窗格同时运行
3. **AI 操作**: AI 在底部窗格自动执行命令
4. **人类介入**: 只在需要时（如确认重启、查看特殊输出）

### 快捷键

```bash
Ctrl+b + ↑        # 到前端窗格
Ctrl+b + ↓        # 到 AI 窗格
Ctrl+b + ←        # 到后端窗格
Ctrl+b + d        # 分离（后台继续运行）
tmux attach       # 重新连接
```

### 退出方式

**方法1: 分离（推荐）** - 服务继续运行，可恢复
```bash
# 按 Ctrl+b，然后按 d
# 效果: 回到普通终端，三个服务在后台继续运行

# 之后可以恢复
tmux attach -t gateway-dev
```

**方法2: 停止服务后退出**
```bash
# 在每个窗格按 Ctrl+c 停止服务，然后 exit
Ctrl+b + ↑    # 去前端窗格
Ctrl+c        # 停止前端服务
exit          # 退出前端窗格

Ctrl+b + ←    # 去后端窗格  
Ctrl+c        # 停止后端服务
exit          # 退出后端窗格

Ctrl+b + ↓    # 去 pi 窗格
exit          # 或按 Ctrl+d 退出 pi
```

**方法3: 强制关闭全部**
```bash
# 直接关闭终端窗口
# 或在另一个终端执行:
tmux kill-session -t gateway-dev
```

### 手动控制（备用）

```bash
# 会话管理
bash scripts/tmux-dev.sh create      # 创建会话
bash scripts/tmux-dev.sh attach      # 进入观察
bash scripts/tmux-dev.sh kill        # 终止会话

# 服务控制
bash scripts/tmux-dev.sh start       # 启动所有
bash scripts/tmux-dev.sh stop        # 停止所有
bash scripts/tmux-dev.sh restart     # 重启所有
bash scripts/tmux-dev.sh clear-cache # 清除缓存
```

## 调试

```bash
# Chrome DevTools
http://127.0.0.1:5173

# 移动端调试
http://<ip>:5173?debug=true

# 检查服务状态
bash scripts/dev-status.sh
```

## 参考文档

- [FEATURES.md](./FEATURES.md) - 功能规格说明书
- [CHANGELOG.md](./CHANGELOG.md) - 变更历史
- [mock-data/README.md](./mock-data/README.md) - Mock 数据说明
