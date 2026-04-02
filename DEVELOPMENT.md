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

### 前端架构原则

```
UI = f(State)
```

- **函数组件 + Hooks**: 全面使用 Function Component
- **单向数据流**: 数据自上而下，事件自下而上
- **严格分层**: 视图(UI) ← 逻辑(Hooks) ← 状态(Store) ← 服务(API)
- **不可变性**: 所有状态更新必须返回新对象

### 项目结构

```
src/client/
├── app/                    # 应用核心层 (layout, providers)
├── features/               # 功能域 (chat/, files/, sidebar/)
├── shared/                 # 共享资源 (components, hooks, utils)
├── pages/                  # 页面组件
├── stores/                 # 全局状态 (Zustand)
├── services/               # API 服务
└── types/                  # 全局类型
```

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

**组件规范**:
- 单一职责，组件不超过 200 行
- Props 必须定义 TypeScript 接口
- 事件命名使用 `on + 动词 + 名词` (如 `onToggleCollapse`)
- 使用稳定 key，禁止使用 index

### 状态管理

| 状态类型 | 工具 | 使用场景 |
|----------|------|----------|
| 局部状态 | useState | 表单输入、开关状态 |
| 功能域状态 | Zustand | 聊天消息、文件列表 |
| 全局状态 | Zustand | 用户信息、主题设置 |

```typescript
// ✅ 正确: 使用 Selector 订阅局部状态
const messages = useChatStore((s) => s.messages);
const isStreaming = useChatStore((s) => s.isStreaming);

// ❌ 错误: 解构获取整个 store
const store = useChatStore();  // 会导致不必要的重渲染

// ✅ 正确: 直接调用 store action
const setCurrentDir = useSessionStore((s) => s.setCurrentDir);
setCurrentDir('/new/path');
```

### Hooks 规范

```typescript
// ✅ 必须以 use 开头
function useChat() { }
function useVirtualList() { }

// useEffect 适用场景
useEffect(() => {
  const subscription = websocketService.subscribe(callback);
  return () => subscription.unsubscribe();  // 必须清理
}, []);

// ❌ 禁止: 在组件中直接 fetch
useEffect(() => {
  fetch('/api/data').then(...);  // 应该放在 services/
}, []);
```

### 性能优化

```typescript
// ✅ 大数据列表使用虚拟滚动
import { FixedSizeList } from 'react-window';

// ✅ 使用 useMemo 缓存计算
const filteredMessages = useMemo(() => 
  messages.filter(m => m.visible),
  [messages]
);

// ✅ 使用 useCallback 缓存回调
const handleToggle = useCallback((id: string) => {
  toggleMessage(id);
}, [toggleMessage]);
```

### 代码风格

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件 | PascalCase | `MessageItem`, `ChatPage` |
| Hooks | camelCase + use | `useChat`, `useVirtualList` |
| Store | camelCase + Store | `chatStore`, `sessionStore` |
| 类型 | PascalCase | `Message`, `ChatState` |
| 接口 | PascalCase + Props | `MessageItemProps` |

**导入顺序**:
```typescript
// 1. React 核心
// 2. 第三方库
// 3. 内部共享 (@/shared/*)
// 4. 功能域内 (../store/*)
// 5. 类型
// 6. 样式
```

### 常见错误

| 错误 | 正确做法 |
|------|----------|
| `document.getElementById` | 使用 React ref |
| `Math.random()` 作为 key | 使用稳定唯一 ID |
| 直接修改数组/对象 | 返回新对象 `[...arr]` |
| 在 render 中创建新函数 | 使用 useCallback |
| 组件 > 200 行 | 拆分组件 |
| props 穿透超过 3 层 | 使用 Context 或 Store |

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

## WebSocket API

### 消息类型

| 消息类型 | 方向 | 说明 |
|---------|------|------|
| `init` | C→S | 初始化 session，返回完整 session 信息 |
| `prompt` | C→S | 发送消息给 AI |
| `abort` | C→S | 中止生成 |
| `change_dir` | C→S | 切换工作目录 |
| `new_session` | C→S | 创建新 session |
| `list_sessions` | C→S | 列出工作目录的所有 session |
| `load_session` | C→S | 加载指定 session |
| `set_model` | C→S | 设置模型 |
| `thinking_level_change` | C→S | 切换思考级别 |
| `initialized` | S→C | init 完成响应 |
| `dir_changed` | S→C | 目录切换完成 |
| `session_loaded` | S→C | session 加载完成 |
| `sessions_list` | S→C | session 列表 |

### 示例

```typescript
// 初始化 Session
websocketService.send("init", {
  workingDir: "/root/project",
  sessionId: "optional-existing-session-id"
});

// 响应
{
  type: "initialized",
  sessionId: "xxx",
  sessionFile: "/path/to/session.jsonl",
  workingDir: "/root/project",
  model: "claude-3-5-sonnet",
  thinkingLevel: "medium",
  systemPrompt: "...",
  agentsFiles: [...],
  skills: [...],
  pid: 12345
}
```

## 调试技巧

1. **前端热重载**: Vite 自动重载，无需手动刷新
2. **后端热重载**: tsx 监视模式，自动重启
3. **WebSocket 调试**: 查看浏览器 DevTools Network WS 标签
4. **状态检查**: Redux DevTools 可查看 Zustand 状态
