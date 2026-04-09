# UI React 组件重构与规范化整合指南

> **版本**: v2.0  
> **适用范围**: React + TypeScript + Zustand 项目  
> **目标**: 在不改变任何业务逻辑的前提下，提升代码可读性、可维护性和工程化水平

---

## 🎯 核心目标

在 **不改变任何业务逻辑和行为** 的前提下：

- ✅ 提升代码可读性
- ✅ 优化结构组织
- ✅ 提升可维护性
- ✅ 减少不必要的拆分
- ✅ 统一 UI 状态设计
- ✅ 明确 Props / State / Store 边界
- ✅ 统一命名规范
- ✅ 让代码更符合工程化规范

---

## ❗ 绝对约束（最高优先级）

| 约束项 | 说明 |
|--------|------|
| ❌ 不允许修改任何业务逻辑 | 保持原有逻辑不变 |
| ❌ 不允许改变功能行为 | 用户感知的行为完全一致 |
| ❌ 不允许改变数据流 | 数据流向保持不变 |
| ❌ 不允许新增功能 | 纯重构，不添加新功能 |
| ❌ 不允许删除逻辑 | 所有原有逻辑必须保留 |
| ❌ 不允许"顺手优化逻辑" | 禁止借重构之名改逻辑 |
| ❌ 不允许引入任何 bug 或潜在风险 | 确保重构安全可靠 |

**👉 如有不确定，宁可不优化**

---

## 📐 组件内部结构（强制顺序）

组件内部必须按照以下顺序组织代码：

```typescript
function Component() {
  // ========== 1. State ==========
  const [isVisible, setIsVisible] = useState(false);
  const messages = useChatStore((s) => s.messages);
  
  // ========== 2. Ref ==========
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // ========== 3. Effects ==========
  useEffect(() => {
    // 副作用逻辑
  }, [dependency]);
  
  // ========== 4. Computed ==========
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => m.visible);
  }, [messages]);
  
  // ========== 5. Actions ==========
  const handleClick = useCallback(() => {
    setVisible(true);
  }, []);
  
  // ========== 6. Render ==========
  return (
    <div ref={containerRef}>
      {/* UI 渲染 */}
    </div>
  );
}
```

### 顺序说明

| 顺序 | 类别 | 说明 |
|------|------|------|
| 1 | State | 状态定义在最前，一目了然 |
| 2 | Ref | DOM 引用紧随其后 |
| 3 | Effects | 副作用逻辑 |
| 4 | Computed | 计算属性（如有） |
| 5 | Actions | 事件处理函数（如有） |
| 6 | Render | JSX 渲染放最后 |

> 💡 **提示**: 这是"组织顺序"，不是强制必须全部存在。允许某一类不存在，但**顺序必须保持**。每一块必须用注释分区（`// ========== X. Section ==========`）。

---

## 🧠 UI 状态 / Props / 数据源分类（核心规范）

请严格区分三类数据，这是架构清晰的关键：

### 1️⃣ UI 状态（组件内部控制）

**定义**: 只影响界面表现，不属于业务数据

**示例**:
- `isVisible` / `isOpen` - 可见性
- `isLoading` - 加载状态
- `isSelected` / `isActive` - 选中状态
- `isExpanded` / `isCollapsed` - 展开状态
- `hasError` - 错误状态
- `isFocused` - 聚焦状态

**规则**:
- ✅ **必须使用 useState** 管理
- ❌ **不允许放入 store**（除非是全局 UI 状态如主题）
- ❌ **不允许作为业务数据使用**
- ✅ **命名必须使用 `isXxx` 或 `hasXxx` 格式**

### 2️⃣ Props（外部控制输入）

**定义**: 组件对外暴露的控制参数，外部传入的数据

**示例**:
- `value` - 受控值
- `visible` / `open` - 受控可见性
- `data` / `list` - 数据源
- `selectedId` - 选中 ID
- `onChange` / `onSelect` - 回调函数

**规则**:
- Props 是"外部输入"，组件**不能直接修改**
- 用于控制组件行为（Controlled Component 模式）
- 通过回调函数通知外部状态变化

### 3️⃣ 数据源（Domain Data / Business Data）

**定义**: 业务数据，应用的核心数据

**示例**:
- `messageList` / `messages` - 消息列表
- `fileList` / `files` - 文件列表
- `user` / `currentUser` - 用户信息
- `config` / `configuration` - 配置信息

**存储策略决策流程**:

```
数据源 → 判断使用范围
    ├── 跨组件共享、多模块依赖、全局数据 → 公用 store
    ├── 功能模块专用、局部共享 → 专用 feature store
    └── 仅组件内部使用 → useState
```

#### 决策规则

| 场景 | 推荐方案 | 示例 |
|------|----------|------|
| 跨组件共享、全局数据 | ✅ 公用 store | `useAppStore`, `useUserStore` |
| 功能模块专用 | ✅ 专用 feature store | `useChatStore`, `useFileStore` |
| 仅组件内部使用 | ✅ useState | 临时表单数据 |

### ❗ 严格禁止的混用模式

- ❌ **UI状态放入 store**（除非是全局 UI 如主题、侧边栏状态）
- ❌ **UI状态作为数据源**使用
- ❌ **数据写死在组件内部**（应通过 props 或 store 传入）
- ❌ **Props 和 State 职责混乱**（一个变量既做输入又做输出）

---

## 🔁 数据流规范（必须遵守）

### 单向数据流模式

```
外部数据源 → Props → 组件 → Callback → 外部更新
```

### 输入（Props - 只读）

- `value` - 受控值
- `data` / `list` - 数据
- `visible` / `open` - 可见性状态
- `disabled` - 禁用状态

### 输出（Callback - 事件通知）

**必须使用 `onXxx` 命名模式**:
- `onChange` - 值变化
- `onSelect` - 选择
- `onSubmit` - 提交
- `onClose` - 关闭
- `onClick` - 点击

### 示例

```typescript
// ✅ 正确的数据流
interface UserSelectorProps {
  users: User[];           // 输入：数据
  selectedId?: string;     // 输入：选中状态
  onSelect: (id: string) => void;  // 输出：选择事件
}

function UserSelector({ users, selectedId, onSelect }: UserSelectorProps) {
  // 组件内部可以有自己的 UI 状态
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // 通过回调通知外部
  const handleSelect = useCallback((id: string) => {
    onSelect(id);
    setIsDropdownOpen(false);
  }, [onSelect]);
  
  // ...
}
```

**❌ 绝对禁止**:
- 组件直接修改外部数据
- 组件直接修改 props
- 通过全局变量跳过数据流

---

## 🏷️ UI 标准属性命名规范（必须统一）

### 1️⃣ Boolean 类型属性

| 类别 | 正确命名 | 错误命名 |
|------|----------|----------|
| 可见性 | `isVisible`, `isOpen` | `show`, `visible`, `open` |
| 加载状态 | `isLoading`, `isFetching` | `loading`, `fetching` |
| 选中状态 | `isSelected`, `isActive` | `selected`, `active` |
| 展开状态 | `isExpanded`, `isCollapsed` | `expanded`, `collapsed` |
| 错误状态 | `hasError`, `isError` | `error`, `failed` |
| 禁用状态 | `isDisabled` | `disabled`, `inactive` |
| 聚焦状态 | `isFocused` | `focused` |

### 2️⃣ 列表数据属性

| 数据类型 | 推荐命名 | 示例 |
|----------|----------|------|
| 消息列表 | `messageList`, `messages` | `messages: Message[]` |
| 文件列表 | `fileList`, `files` | `files: FileItem[]` |
| 用户列表 | `userList`, `users` | `users: User[]` |
| 配置列表 | `configList`, `configs` | `configs: Config[]` |

### 3️⃣ 函数命名规范

| 类型 | 命名模式 | 示例 | 用途 |
|------|----------|------|------|
| 事件处理器 | `handleXxx` | `handleClick`, `handleChange` | 组件内部事件处理 |
| 回调函数 | `onXxx` | `onClick`, `onChange` | 对外暴露的回调 |
| 状态设置 | `setXxx` | `setVisible`, `setValue` | 状态更新函数 |
| 动作函数 | `doXxx` | `doSearch`, `doRefresh` | 执行特定动作 |

### 4️⃣ 组件命名规范

| 组件类型 | 命名模式 | 示例 |
|----------|----------|------|
| 容器组件 | `XxxPanel`, `XxxContainer` | `ChatPanel`, `FileContainer` |
| 弹窗组件 | `XxxModal`, `XxxDialog` | `SettingsModal`, `ConfirmDialog` |
| 列表组件 | `XxxList`, `XxxGrid` | `MessageList`, `FileGrid` |
| 单项组件 | `XxxItem`, `XxxCard` | `MessageItem`, `FileCard` |
| 表单组件 | `XxxForm`, `XxxInput` | `LoginForm`, `SearchInput` |

### 5️⃣ Hook 命名规范

- **必须**以 `use` 开头：`useXxx`
- 表示动作：`useFetchData`, `useFormValidation`
- 表示状态：`useUserProfile`, `useAppSettings`

---

## 🧩 状态划分与分层架构

### 推荐的分层结构

```
┌─────────────────────────────────────┐
│        UI State（界面状态层）         │
│  - isVisible, isExpanded, isLoading  │
│  - 组件内部控制，影响 UI 展示          │
│  - 使用 useState 管理                 │
├─────────────────────────────────────┤
│     Domain State（业务数据层）        │
│  - messages, files, user, config     │
│  - 业务核心数据，跨组件共享            │
│  - 使用 Zustand / Context 管理        │
├─────────────────────────────────────┤
│    Derived State（计算状态层）        │
│  - filteredList, formattedData       │
│  - 基于其他状态计算得出                │
│  - 使用 useMemo 缓存                  │
└─────────────────────────────────────┘
```

### 正确的分层示例

```typescript
function MessageList() {
  // ========== 1. UI State ==========
  const [isLoading, setIsLoading] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  
  // ========== 2. Domain State ==========
  const messages = useChatStore((s) => s.messages);
  const currentUser = useUserStore((s) => s.currentUser);
  
  // ========== 3. Derived State ==========
  const unreadCount = useMemo(() => {
    return messages.filter((m) => !m.read).length;
  }, [messages]);
  
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => m.type === 'text');
  }, [messages]);
  
  // ========== 4. Actions ==========
  const handleLoadMore = useCallback(async () => {
    setIsLoading(true);
    try {
      await loadMoreMessages();
    } finally {
      setIsLoading(false);
    }
  }, [loadMoreMessages]);
  
  // ========== 5. Render ==========
  return (
    <div>
      {/* 渲染逻辑 */}
    </div>
  );
}
```

---

## 📦 Zustand 状态管理规范

### Store 拆分原则

- ✅ **按"功能域（feature）"拆分**，避免巨大 store
- ✅ **一个功能域一个 store**，职责单一
- ✅ **Selector 精确取数**，避免不必要重渲染
- ❌ **禁止在组件中写复杂业务逻辑**

### 推荐的项目结构

```
src/
├── features/
│   ├── chat/                    # 聊天功能域
│   │   ├── stores/
│   │   │   ├── chatStore.ts      # 聊天消息状态
│   │   │   ├── sidebarStore.ts   # 侧边栏状态
│   │   │   └── modalStore.ts     # 弹窗状态
│   │   ├── hooks/               # 业务逻辑 hooks
│   │   ├── components/          # UI 组件
│   │   └── types/               # 类型定义
│   └── files/                   # 文件功能域
│       ├── stores/
│       │   ├── fileStore.ts      # 文件浏览状态
│       │   └── viewerStore.ts    # 文件查看器状态
│       └── ...
└── shared/                      # 共享功能
    ├── stores/
    │   ├── appStore.ts          # 应用全局状态
    │   └── userStore.ts         # 用户全局状态
    └── ...
```

### Selector 最佳实践

```typescript
// ✅ 好的做法：精确选择需要的数据
const messages = useChatStore((s) => s.messages);
const isStreaming = useChatStore((s) => s.isStreaming);

// ❌ 不好的做法：解构整个 store（导致不必要的重渲染）
const store = useChatStore();  // 禁止！
const { messages, isStreaming } = store;

// ❌ 特别禁止：在组件中解构多个 selector
const { messages, isStreaming, selectedId, inputText } = useChatStore(); // 绝对禁止！
```

### Store 内部组织模板

```typescript
export interface ChatState {
  // ========== State ==========
  messages: Message[];
  isStreaming: boolean;
  selectedId: string | null;
  inputText: string;
}

export interface ChatActions {
  // ========== Actions ==========
  addMessage: (message: Message) => void;
  setStreaming: (streaming: boolean) => void;
  setInputText: (text: string) => void;
}

export const useChatStore = create<ChatState & ChatActions>()(
  devtools(
    (set, get) => ({
      // ========== State ==========
      messages: [],
      isStreaming: false,
      selectedId: null,
      inputText: '',
      
      // ========== Actions ==========
      addMessage: (message) => {
        set((state) => ({
          messages: [...state.messages, message],
        }), false, 'chat/addMessage');
      },
      
      setStreaming: (streaming) => {
        set({ isStreaming: streaming }, false, 'chat/setStreaming');
      },
      
      setInputText: (text) => {
        set({ inputText: text }, false, 'chat/setInputText');
      },
    }),
    { name: 'ChatStore' }
  )
);
```

---

## 🧱 文件结构优化策略

### 合并条件（必须执行）

遇到以下情况，**必须进行合并**：

- ✅ **小组件**（< 100 行代码）
- ✅ **仅被单一地方使用**（无复用价值）
- ✅ **代码非常碎片化**（多个 < 50 行的文件）
- ✅ **文件数量过多影响阅读**（同一功能拆分成太多小文件）

### 合并原则

- ✅ **相关逻辑聚合在一起**，提高内聚性
- ✅ **可读性 > 形式规范**，实用优先
- ✅ **以"功能"为单位**，而不是"类型"为单位

### 拆分条件

- ✅ **可复用组件**（被多个地方使用）
- ✅ **复杂业务逻辑**（需要独立测试和维护）
- ✅ **IO / 请求逻辑**（需要独立封装）
- ✅ **独立的功能模块**（可以独立开发和测试）

### 推荐的文件组织结构

#### 小型组件（合并策略）

```typescript
// InputArea.tsx - 包含所有相关逻辑

// 1. 类型定义
interface InputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
}

// 2. 主组件
export function InputArea({ value, onChange, onSend }: InputAreaProps) {
  // 主组件逻辑
}

// 3. 子组件（仅在此处使用）
function ToolbarButton({ onClick, icon }: { onClick: () => void; icon: string }) {
  return <button onClick={onClick}>{icon}</button>;
}

// 4. 辅助函数（仅在此处使用）
function formatText(text: string): string {
  return text.trim();
}

// 5. 样式导入
import styles from './InputArea.module.css';
```

#### 中型组件（适度拆分）

```
InputArea/
├── InputArea.tsx          # 主组件
├── InputArea.module.css   # 样式文件
├── useInputArea.ts        # 复杂逻辑 Hook
├── types.ts               # 类型定义（如果复杂）
└── index.ts               # 统一导出
```

#### 大型功能（Feature-Based 架构）

```
chat/                           # 聊天功能域
├── components/                 # UI 组件层
│   ├── ChatPanel.tsx          # 主面板
│   ├── InputArea.tsx          # 输入区域
│   ├── MessageList.tsx        # 消息列表
│   └── MessageItem.tsx        # 消息项
├── hooks/                     # 业务逻辑层
│   ├── useChatPanel.ts        # 面板逻辑
│   ├── useInputArea.ts        # 输入逻辑
│   └── useMessageList.ts      # 列表逻辑
├── stores/                    # 状态管理层
│   ├── chatStore.ts           # 聊天状态
│   ├── sidebarStore.ts        # 侧边栏状态
│   └── modalStore.ts          # 弹窗状态
├── services/                  # 服务层
│   ├── chatApi.ts             # API 调用
│   └── websocket.ts           # WebSocket 连接
├── types/                     # 类型定义层
│   └── chat.ts                # 聊天相关类型
└── index.ts                   # 功能域入口
```

### ❗ 禁止的过度拆分

- ❌ **不要为了"规范"强行拆很多文件**
- ❌ **不要把一个简单逻辑拆成多个文件**（如：`utils.ts`、`helpers.ts`、`common.ts`）
- ❌ **不要引入过多抽象层**（如：`adapter`、`factory`、`strategy` 除非必要）
- ❌ **不要创建只有几行代码的文件**

---

## 🎨 样式规范与最佳实践

### 样式方案选择

| 场景 | 推荐方案 | 示例 | 说明 |
|------|----------|------|------|
| 简单组件 | CSS Modules + 内联样式 | `style={{ color }}` + `styles.container` | 简单灵活 |
| 复杂组件 | CSS Modules 独立文件 | `Component.module.css` | 样式分离 |
| 全局样式 | CSS 变量 + 主题系统 | `:root { --primary-color }` | 统一设计 |
| 动态样式 | 条件类名 | `className={isActive ? styles.active : ''}` | 状态驱动 |
| 动画效果 | CSS Transitions | `transition: all 0.2s ease` | 性能优化 |

### CSS Module 文件组织

```css
/* Component.module.css */

/* ========== Layout ========== */
.container {
  display: flex;
  flex-direction: column;
}

.header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.content {
  flex: 1;
  overflow: auto;
}

/* ========== Components ========== */
.button {
  padding: 8px 16px;
  border-radius: var(--radius-md);
  border: none;
  cursor: pointer;
}

.buttonPrimary {
  background: var(--accent-primary);
  color: white;
}

.buttonDisabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ========== States ========== */
.loading {
  opacity: 0.7;
  pointer-events: none;
}

.error {
  border-color: var(--accent-red);
  background: rgba(248, 81, 73, 0.1);
}

.empty {
  color: var(--text-tertiary);
  font-style: italic;
}

/* ========== Responsive ========== */
@media (max-width: 768px) {
  .container {
    padding: 8px;
  }
  
  .header {
    padding: 8px 12px;
  }
}
```

### 命名规范

```css
/* ✅ 好的命名 - 语义化、清晰 */
.messageContainer { ... }
.sendButton { ... }
.userAvatar { ... }
.inputField { ... }
.errorMessage { ... }

/* ❌ 不好的命名 - 避免这些 */
.msg-ctr { ... }      /* 缩写不清晰 */
.btn { ... }          /* 过于简短 */
.wrapper { ... }      /* 无意义 */
.div1 { ... }         /* 无意义数字 */
```

### 性能与可维护性建议

1. **避免过度嵌套**：CSS Modules 中尽量减少嵌套层级
2. **使用 CSS 变量**：统一设计系统，便于主题切换
3. **组件样式隔离**：避免全局样式污染
4. **移动优先**：优先编写移动端样式，再添加桌面端增强
5. **减少 !important**：尽量避免使用，如需使用请注释原因

---

## 🧾 SVG 图标处理规范

### 决策流程

```
SVG 图标
    │
    ├── 简单图标（< 10 个 path，无复杂图形）
    │       └── 内联 JSX 或组件化
    │
    └── 复杂图标（>= 10 个 path，或复杂图形）
            └── 独立文件导入
```

### 简单图标（内联方案）

```typescript
// 直接在组件中定义简单图标
function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M22 2L11 13" strokeWidth="2" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" strokeWidth="2" />
    </svg>
  );
}

// 在组件中使用
function SendButton() {
  return (
    <button>
      <SendIcon />
      Send
    </button>
  );
}
```

### 复杂图标（独立文件方案）

```typescript
// assets/icons/ComplexIcon.tsx
import type { SVGProps } from 'react';

export function ComplexIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" {...props}>
      {/* 复杂 SVG 路径 */}
      <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4z" fill="#4285F4" />
      <path d="M24 12v8h8c-0.36 2.11-1.64 3.89-3.53 5.12l5.47 4.24c3.23-2.98 5.06-7.36 5.06-12.36 0-1.21-.13-2.38-.36-3.5H24z" fill="#34A853" />
      {/* ... 更多路径 */}
    </svg>
  );
}

// 在组件中使用
import { ComplexIcon } from '@/assets/icons/ComplexIcon';

function LoginButton() {
  return (
    <button>
      <ComplexIcon width={20} height={20} />
      Sign in with Google
    </button>
  );
}
```

### 图标库管理方案

```
src/
├── components/
│   └── icons/                  # 图标组件库
│       ├── index.ts            # 统一导出
│       ├── SendIcon.tsx        # 发送图标
│       ├── CloseIcon.tsx       # 关闭图标
│       ├── FolderIcon.tsx      # 文件夹图标
│       ├── FileIcon.tsx        # 文件图标
│       └── types.ts            # 图标类型定义
└── features/
    └── chat/
        └── components/
            └── MessageItem.tsx  # 使用图标
```

### 图标使用最佳实践

1. **统一尺寸**：使用 `width` 和 `height` 属性控制尺寸
2. **颜色继承**：使用 `currentColor` 继承父级文本颜色
3. **可访问性**：添加 `aria-label` 或 `role="img"`
4. **性能优化**：复杂图标使用 `React.memo` 包装

---

## 📋 输出要求与质量保证

### 重构后代码必须满足

- ✅ **功能完全一致**：零业务逻辑变更
- ✅ **结构清晰统一**：符合所有规范要求
- ✅ **可读性显著提升**：新人能快速理解
- ✅ **可维护性增强**：便于后续修改和扩展
- ✅ **无性能退化**：不引入不必要的重渲染

### 自检清单（重构完成后必须检查）

**业务逻辑完整性**:
- [ ] 所有原有功能正常工作
- [ ] 用户交互行为无变化
- [ ] 数据流保持原有路径
- [ ] 边界条件处理一致

**代码结构规范性**:
- [ ] 组件内部结构符合顺序（State → Ref → Effects → Computed → Actions → Render）
- [ ] UI状态/Props/数据源分类清晰
- [ ] 状态分层合理（UI State / Domain State / Derived State）
- [ ] 文件结构优化适当（无过度拆分）

**命名与样式**:
- [ ] UI状态命名统一（`isXxx` / `hasXxx` 格式）
- [ ] 函数命名规范（`handleXxx` / `onXxx` / `setXxx`）
- [ ] 组件命名合理（`XxxPanel` / `XxxModal` / `XxxItem`）
- [ ] 样式命名语义化、无冲突

**性能与可维护性**:
- [ ] 无不必要的重渲染
- [ ] Zustand selector 使用正确
- [ ] 无内存泄漏风险
- [ ] 代码易于测试

### 提交规范

每次重构提交必须包含清晰的提交信息：

```
type(scope): description

Types: refactor, fix, style, chore
Scope: component name or feature area

Example:
refactor(MessageItem): restructure with UI refactoring guidelines
fix(IconButton): eliminate button rounding flicker
style(Footer): update CSS for consistency
```

---

## 📝 完整示例：重构前后对比

### 重构前 ❌（结构混乱、职责不清）

```typescript
// 混乱的顺序，混合的状态，职责不清
function ChatInput() {
  const handleSend = () => { ... };  // Action 在最前
  
  const [text, setText] = useState('');  // State 在中间
  const messages = useStore(s => s.messages);  // Store 混用
  
  useEffect(() => { ... }, []);  // Effect 在最后
  
  const ref = useRef(null);  // Ref 分散
  
  const filtered = useMemo(() => ...);  // Computed 穿插
  
  // UI 状态和业务数据混在一起
  const [loading, setLoading] = useState(false);
  const items = useState([]);  // 数据放在组件内部
  
  return ...;
}
```

### 重构后 ✅（结构清晰、职责明确）

```typescript
function ChatInput({ onSend }: { onSend: (text: string) => void }) {
  // ========== 1. State ==========
  const [inputText, setInputText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // ========== 2. Ref ==========
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // ========== 3. Effects ==========
  useEffect(() => {
    // 自动调整文本区域高度
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [inputText]);
  
  // ========== 4. Computed ==========
  const charCount = useMemo(() => inputText.length, [inputText]);
  const isOverLimit = charCount > MAX_LENGTH;
  
  // ========== 5. Actions ==========
  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
  }, []);
  
  const handleSend = useCallback(() => {
    if (!inputText.trim() || isOverLimit) return;
    
    setIsLoading(true);
    try {
      onSend(inputText);
      setInputText('');  // 清空输入
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isOverLimit, onSend]);
  
  // ========== 6. Render ==========
  return (
    <div ref={containerRef} className={styles.container}>
      <textarea
        ref={textareaRef}
        value={inputText}
        onChange={handleChange}
        className={`${styles.textarea} ${isOverLimit ? styles.error : ''}`}
        disabled={isLoading}
        placeholder="Type your message..."
      />
      
      <div className={styles.footer}>
        <span className={styles.charCount}>
          {charCount} / {MAX_LENGTH}
        </span>
        
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={isLoading || !inputText.trim() || isOverLimit}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

---

## 🔗 相关文档与参考

- [DEVELOPMENT.md](./DEVELOPMENT.md) - 项目开发规范
- [FEATURES.md](./FEATURES.md) - 功能规格说明
- [CHANGELOG.md](./CHANGELOG.md) - 变更历史记录
- [ERROR_HANDLING.md](./ERROR_HANDLING.md) - 错误处理规范

---

**版本**: v2.0  
**最后更新**: 2026-04-09  
**维护者**: Frontend Architecture Team  
**状态**: 正式发布

> 💡 **提示**: 本规范是团队协作的基础，所有前端开发人员必须严格遵守。如有特殊情况需要偏离规范，必须经过架构评审并记录原因。