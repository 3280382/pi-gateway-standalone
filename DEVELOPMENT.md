# 开发指南

## 🎯 当前项目
**项目名称**: pi-gateway-standalone  
**项目位置**: /root/pi-gateway-standalone  
**GitHub**: https://github.com/3280382/pi-gateway-standalone

## 快速开始 (推荐: Tmux 三窗格模式)

```bash
bash scripts/start-tmux-dev.sh
```

这会在一个 tmux 会话中创建三个窗格：
- **上左**: 前端服务 (http://127.0.0.1:5173)
- **上右**: 后端服务 (http://127.0.0.1:3000)
- **底部**: AI 交互窗格

快捷键:
- `Ctrl+b + ↑/↓/←/→` - 切换窗格
- `Ctrl+b + d` - 分离会话（后台继续运行）

### 传统启动方式

```bash
bash dev-start.sh  # 非 tmux，直接在后台运行
```

## 项目架构

采用**模块化单体架构 (Modular Monolith)**：

```
src/
├── client/              # 🎨 前端代码
│   ├── components/
│   │   ├── layout/      # 布局组件
│   │   │   ├── AppLayout/      # 统一布局控制器
│   │   │   ├── TopBar/         # 顶部菜单
│   │   │   ├── BottomMenu/     # 底部菜单
│   │   │   ├── SidebarPanel/   # 侧边栏
│   │   │   └── AppLayout/      # 布局上下文
│   │   ├── chat/        # 聊天组件
│   │   └── files/       # 文件浏览器
│   ├── stores/          # Zustand 状态管理
│   ├── services/        # API 和 WebSocket 服务
│   └── App.tsx          # 根组件
├── server/              # 🖥️ 后端代码
│   ├── session/         # GatewaySession 会话管理
│   ├── routes/          # Express 路由
│   └── server.ts        # 服务器入口
└── shared/              # 🔗 共享类型
```

## 核心架构组件

### 1. AppLayout 统一布局系统

所有视图共享统一的布局框架：

```
┌─────────────────────────────────────────┐
│ Header (64px) - TopBar                  │
│ ├─ Row1: 模型 | Thinking | 状态指示器   │
│ └─ Row2: 工作目录 | 搜索框              │
├──────────┬──────────────────────────────┤
│ Sidebar  │  Content                     │
│ (可隐藏) │  ├─ contentBody (消息/文件)  │
│ 280px    │  └─ inputArea (聊天输入框)   │
├──────────┴──────────────────────────────┤
│ Footer (44px) - BottomMenu              │
├─────────────────────────────────────────┤
│ BottomPanel - 可弹出终端/预览           │
└─────────────────────────────────────────┘
```

**设计原则**:
- 布局样式集中在 `AppLayout.module.css`
- 子组件只负责内容渲染，不控制布局位置
- 通过 `LayoutContext` 统一管理侧边栏、底部面板状态

### 2. 状态管理架构

#### 前端状态 (Zustand + Persist)

```typescript
// sessionStore.ts - 持久化到 localStorage
{
  currentSessionId,  // 当前会话 ID
  currentDir,        // 当前工作目录
  currentModel,      // 当前模型
  thinkingLevel,     // Thinking 级别
  theme,             // 主题
  recentWorkspaces,  // 最近工作区
}

// chatStore.ts - 内存状态
{
  messages,          // 消息列表
  isStreaming,       // 是否正在流式输出
  inputText,         // 输入框文本
}
```

#### 后端状态 (GatewaySession)

```typescript
class GatewaySession {
  session: AgentSession | null;  // pi-coding-agent 会话
  workingDir: string;             // 当前工作目录
  ws: WebSocket;                  // WebSocket 连接
  
  initialize(workingDir, sessionId?)  // 初始化会话
  dispose()                           // 清理资源，自动保存
}
```

### 3. 工作目录与 Session 生命周期

```
┌─────────────┐     WebSocket连接      ┌──────────────┐
│   前端      │ ─────────────────────> │   后端       │
│ 选择目录    │                        │ GatewaySession│
└─────────────┘                        └──────┬───────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │ 1. 终止旧 pi 进程 │
                                    │ 2. 在新目录启动 pi│
                                    │ 3. 加载/创建会话  │
                                    │ 4. 返回新 PID     │
                                    └──────────────────┘
```

**关系说明**:
- **工作目录**: pi 进程的工作目录，文件操作基于此目录
- **Session 文件**: 持久化的会话历史（`.pi/sessions/`）
- **PID**: 动态进程号，每次启动 pi 都不同

## 路径别名

```typescript
// 前端
import { AppLayout } from '@/components/layout/AppLayout';
import { useSessionStore } from '@/stores/sessionStore';
import type { Message } from '@shared/types/message.types';

// 后端
import { GatewaySession } from '@server/session/gateway-session';
import type { ApiResponse } from '@shared/types/api.types';
```

## 开发规范

### 组件开发

```typescript
// 布局组件只负责布局，内容通过 children 传入
function AppLayout({ children, showInput }: AppLayoutProps) {
  return (
    <div className={styles.layout}>
      <header>...</header>
      <main>{children}</main>
      {showInput && <InputArea />}
    </div>
  );
}

// 内容组件只负责渲染，不参与布局
function MessageList({ messages }: MessageListProps) {
  return <div className={styles.list}>...</div>;
}
```

### 状态更新

```typescript
// ✅ 正确: 直接调用 store action
const setCurrentDir = useSessionStore((s) => s.setCurrentDir);
setCurrentDir('/new/path');

// ❌ 错误: 解构获取整个 store
const store = useSessionStore();  // 会导致不必要的重渲染
```

## 常用命令

```bash
# 开发
npm run dev                       # 启动开发服务器
bash scripts/start-tmux-dev.sh    # Tmux 模式

# 构建与检查
npm run build                     # 生产构建
npm run check                     # 代码检查
npm run typecheck                 # TypeScript 检查

# 测试
npm test                          # 全部测试
npm run test:unit                 # 单元测试
npm run test:e2e                  # E2E 测试

# 服务管理
node scripts/tmux-controller.js status           # 服务状态
node scripts/tmux-controller.js restart-frontend # 重启前端

# 调试
tail -f logs/frontend_current.log  # 前端日志
tail -f logs/backend_current.log   # 后端日志
```

## 测试策略

- **单元测试**: 组件、store、工具函数
- **集成测试**: API 路由、WebSocket 消息
- **E2E 测试**: 完整用户流程（Playwright）

## 调试技巧

1. **前端热重载**: Vite 自动重载，无需手动刷新
2. **后端热重载**: tsx 监视模式，自动重启
3. **WebSocket 调试**: 查看浏览器 DevTools Network WS 标签
4. **状态检查**: Redux DevTools 可查看 Zustand 状态
