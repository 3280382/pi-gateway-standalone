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

采用**模块化单体架构 (Modular Monolith)** - 按功能域组织：

```
src/
├── client/
│   ├── app/                    # 应用根层
│   │   ├── App.tsx
│   │   ├── Footer.tsx
│   │   ├── LayoutContext/      # 全局布局状态
│   │   └── pages/              # ErrorScreen, LoadingScreen
│   │
│   ├── features/               # 功能域（完全自包含）
│   │   ├── chat/               # 聊天功能
│   │   │   ├── components/     # UI 组件
│   │   │   ├── sidebar/        # 侧边栏组件
│   │   │   ├── stores/         # chatStore, sidebarStore...
│   │   │   ├── services/       # chatApi, sidebarApi...
│   │   │   ├── controllers/    # chat.controller
│   │   │   ├── hooks/          # useChat
│   │   │   └── types/          # 类型定义
│   │   │
│   │   └── files/              # 文件功能
│   │       ├── components/     # FileBrowser...
│   │       ├── stores/         # fileStore...
│   │       ├── services/       # fileApi...
│   │       └── hooks/          # useDragDrop...
│   │
│   ├── shared/                 # 全局共享（最少必要）
│   │   ├── ui/                 # 原子组件
│   │   ├── stores/             # sessionStore
│   │   ├── services/           # websocket.service...
│   │   ├── controllers/        # session.controller...
│   │   ├── hooks/              # 全局 hooks
│   │   └── types/              # 类型定义
│   │
│   └── lib/                    # 工具库

├── server/                     # 后端代码
└── shared/                     # 共享类型
```
## 核心架构组件

### 1. 应用布局架构

采用分层布局设计：

```
App (100vh flex column)
├── PageContainer (flex: 1)
│   ├── ChatPage
│   │   └── ChatLayout
│   │       ├── AppHeader (76px)
│   │       ├── SidebarPanel (280px overlay)
│   │       └── ChatPanel (flex: 1)
│   │           ├── MessageList
│   │           └── InputArea
│   │
│   └── FilesPage
│       └── FilesLayout
│           ├── FileToolbar
│           ├── FileSidebar (280px overlay)
│           └── FileBrowser (flex: 1)
│
└── Footer (44px)
```

**设计原则**:
- **App 层级**: 只包含 Footer（全局控件）和 PageContainer
- **Feature 层级**: 每个视图独立管理自己的 Header、Sidebar、Content
- **Chat Sidebar**: 固定定位 overlay，滑动动画
- **Files Sidebar**: 固定定位 overlay，异步加载目录树
- **LayoutContext**: 跨组件状态共享（sidebar 显隐、底部面板等）

### 2. 状态管理架构

#### 前端状态 (Zustand + Persist)

**全局 Stores** (`src/client/shared/stores/`):

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

// chatStore.ts - 聊天状态
{
  messages,          // 消息列表
  isStreaming,       // 是否正在流式输出
  inputText,         // 输入框文本
  activeMessageId,   // 当前激活的消息
}

// fileStore.ts - 文件浏览器状态
{
  currentPath,       // 当前路径
  items,             // 文件列表
  viewMode,          // 视图模式 (grid/list)
  selectedItems,     // 选中的文件
  isLoading,         // 加载状态
}

// sidebarStore.ts - 侧边栏状态
{
  isVisible,         // 是否可见
  activeTab,         // 激活的标签
}

// modalStore.ts - 模态框状态
{
  activeModal,       // 当前激活的模态框
  modalData,         // 模态框数据
}
```

**Feature Stores** (`src/client/features/*/stores/`):
各功能域可拥有独立的局部状态管理

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
├── features/               # 功能域（按业务划分）
│   ├── core/               # 核心应用功能
│   │   ├── layout/         # 全局布局 (AppLayout, AppHeader, AppFooter, panels)
│   │   ├── pages/          # 页面组件 (ChatPage, FilesPage, LoadingScreen)
│   │   ├── providers/      # 全局 Provider
│   │   └── navigation/     # 导航组件
│   ├── chat/               # 聊天功能 (InputArea, MessageList, ChatPanel)
│   ├── files/              # 文件功能 (FileGrid, FileList, BatchActionBar)
│   ├── header/             # 顶部菜单 (ModelSelector, DirectoryPicker, SearchBox)
│   ├── sidebar/            # 侧边栏 (RecentWorkspaces, Sessions, Settings)
│   ├── footer/             # 底部菜单
│   ├── panels/             # 面板 (TerminalPanel, LlmLogPanel)
│   └── system/             # 系统功能 (modals, search)
├── shared/                 # 共享资源
│   ├── components/         # 通用组件
│   │   ├── ui/             # 基础 UI (Button, Input, IconButton, Select)
│   │   ├── layout/         # 布局容器
│   │   └── ErrorBoundary.tsx
│   ├── hooks/              # 通用 Hooks
│   ├── styles/             # 全局样式
│   └── utils/              # 工具函数
├── stores/                 # 全局状态 (Zustand)
│   ├── sessionStore.ts     # 会话设置（持久化）
│   ├── chatStore.ts        # 聊天状态
│   ├── fileStore.ts        # 文件浏览器状态
│   ├── sidebarStore.ts     # 侧边栏状态
│   ├── modalStore.ts       # 模态框状态
│   ├── searchStore.ts      # 搜索状态
│   └── llmLogStore.ts      # LLM 日志状态
├── services/               # API 服务
│   ├── api/                # REST API 客户端
│   └── websocket.service.ts # WebSocket 服务
├── controllers/            # 控制器
├── hooks/                  # 全局 Hooks
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
