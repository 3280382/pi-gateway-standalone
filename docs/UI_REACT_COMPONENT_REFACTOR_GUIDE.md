# UI React 组件重构代码规整规范

> **版本**: v1.0  
> **适用范围**: React + TypeScript + Zustand 项目  
> **目标**: 在不改变业务逻辑的前提下，提升代码可读性和可维护性

---

## 🎯 核心目标

在 **不改变任何业务逻辑和行为** 的前提下：

- ✅ 提升代码可读性
- ✅ 优化结构组织
- ✅ 提升可维护性
- ✅ 减少不必要的拆分
- ✅ 让代码更符合工程化规范

---

## ❗ 绝对约束（必须遵守）

| 约束项 | 说明 |
|--------|------|
| ❌ 不允许修改任何业务逻辑 | 保持原有逻辑不变 |
| ❌ 不允许改变功能行为 | 用户感知的行为完全一致 |
| ❌ 不允许改变数据流 | 数据流向保持不变 |
| ❌ 不允许新增功能 | 纯重构，不添加新功能 |
| ❌ 不允许删除逻辑 | 所有原有逻辑必须保留 |
| ❌ 不允许"顺手优化逻辑" | 禁止借重构之名改逻辑 |

---

## 📐 组件结构规范（必须遵守顺序）

组件内部必须按照以下顺序组织代码：

```typescript
function Component() {
  // 1️⃣ State（useState / Zustand selector）
  const [visible, setVisible] = useState(false);
  const messages = useChatStore((s) => s.messages);
  
  // 2️⃣ Ref（useRef）
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // 3️⃣ Effects（useEffect）
  useEffect(() => {
    // 副作用逻辑
  }, [dependency]);
  
  // 4️⃣ Computed（useMemo，如有）
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => m.visible);
  }, [messages]);
  
  // 5️⃣ Actions（useCallback，如有）
  const handleClick = useCallback(() => {
    setVisible(true);
  }, []);
  
  // 6️⃣ Render（JSX）
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

> 💡 **提示**: 这是"组织顺序"，不是强制必须全部存在。允许某一类不存在，但**顺序必须保持**。

---

## 🧠 UI 标准属性（必须规范化）

### 1️⃣ UI 状态类属性（优先统一）

识别并统一使用以下标准命名：

| 属性名 | 用途 | 示例 |
|--------|------|------|
| `visible` / `isVisible` | 是否可见 | `isModalVisible` |
| `expanded` / `collapsed` | 展开/收起 | `isSidebarExpanded` |
| `minimized` / `maximized` | 最小化/最大化 | `isWindowMaximized` |
| `active` / `selected` | 激活/选中 | `activeTabId` |
| `loading` / `isLoading` | 加载状态 | `isLoading` |
| `error` / `hasError` | 错误状态 | `hasError` |
| `disabled` / `isDisabled` | 禁用状态 | `isButtonDisabled` |
| `open` / `isOpen` | 打开状态 | `isDropdownOpen` |
| `focused` / `isFocused` | 聚焦状态 | `isInputFocused` |

#### 要求

- ✅ 统一收敛到组件的「UI State」
- ✅ 避免分散在多个地方
- ✅ 避免重复定义同类状态
- ✅ 使用一致的命名风格（推荐 `isXxx` 或 `hasXxx`）

#### 反例 ❌

```typescript
// 不好的做法：同一状态多个命名
const [show, setShow] = useState(false);     // 显示
const [hidden, setHidden] = useState(true);  // 隐藏（重复！）
const [display, setDisplay] = useState(true); // 展示（重复！）
```

#### 正例 ✅

```typescript
// 好的做法：统一命名
const [isVisible, setIsVisible] = useState(false);
```

---

### 2️⃣ 数据属性（Data Props / Domain Data）

识别并规范以下数据类属性：

| 数据类型 | 命名规范 | 示例 |
|----------|----------|------|
| 消息列表 | `messageList` / `messages` | `messages: Message[]` |
| 文件列表 | `fileList` / `files` | `files: FileItem[]` |
| 文件夹列表 | `folderList` / `folders` | `folders: Folder[]` |
| 用户信息 | `user` / `currentUser` | `currentUser: User` |
| 配置信息 | `config` / `configuration` | `appConfig: Config` |
| 元数据 | `metadata` / `meta` | `pageMetadata: Metadata` |

#### 要求

- ✅ 与 UI 状态分离
- ✅ 与业务逻辑分离
- ✅ 统一通过 Zustand 或数据层管理（如适用）
- ✅ 明确数据流向

#### 反例 ❌

```typescript
// 不好的做法：UI 状态和数据混在一起
const [items, setItems] = useState([]);        // 数据
const [itemLoading, setItemLoading] = useState(false); // UI 状态（混在一起）
```

#### 正例 ✅

```typescript
// 好的做法：UI 状态和数据分离
// 数据层（Zustand）
const items = useItemStore((s) => s.items);

// UI 层（组件内部）
const [isLoading, setIsLoading] = useState(false);
```

---

## 🧩 状态划分原则（非常重要）

### ✅ 分层结构（推荐）

```
┌─────────────────────────────────────┐
│           UI State（界面状态）         │
│  - visible, expanded, loading       │
│  - 仅影响 UI 展示，不涉及业务数据       │
├─────────────────────────────────────┤
│        Domain State（业务数据）        │
│  - messages, files, user info       │
│  - 通过 Zustand / Context 管理        │
├─────────────────────────────────────┤
│       Derived State（计算值）          │
│  - useMemo 计算的结果                  │
│  - 基于 UI State + Domain State       │
└─────────────────────────────────────┘
```

### ❗ 禁止

- ❌ UI 状态和业务数据混在一起
- ❌ 一个变量同时承担 UI + 数据职责
- ❌ 在多个地方重复定义同一个状态

### 正例 ✅

```typescript
// UI State - 组件内部管理
const [isSidebarVisible, setIsSidebarVisible] = useState(false);
const [isLoading, setIsLoading] = useState(false);

// Domain State - Zustand 管理
const messages = useChatStore((s) => s.messages);
const currentUser = useUserStore((s) => s.currentUser);

// Derived State - 计算属性
const unreadCount = useMemo(() => {
  return messages.filter((m) => !m.read).length;
}, [messages]);
```

---

## 📦 Zustand 规范

### Store 拆分原则

- ✅ **按"功能域（feature）"拆分 store**
- ✅ 避免一个巨大 store
- ✅ Selector 只取需要的数据
- ❌ 不要直接在组件中写复杂逻辑

### 推荐结构

```
src/
├── features/
│   ├── chat/
│   │   ├── stores/
│   │   │   ├── chatStore.ts      # 聊天消息状态
│   │   │   ├── sidebarStore.ts   # 侧边栏状态
│   │   │   └── modalStore.ts     # 弹窗状态
│   │   └── ...
│   └── files/
│       ├── stores/
│       │   ├── fileStore.ts      # 文件浏览状态
│       │   └── viewerStore.ts    # 文件查看器状态
│       └── ...
```

### Selector 最佳实践

```typescript
// ✅ 好的做法：精确选择需要的数据
const messages = useChatStore((s) => s.messages);
const isStreaming = useChatStore((s) => s.isStreaming);

// ❌ 不好的做法：解构整个 store（导致不必要的重渲染）
const store = useChatStore();  // 禁止！
const { messages, isStreaming } = store;
```

### Store 内部组织

```typescript
export const useChatStore = create<State & Actions>()(
  devtools((set, get) => ({
    // ========== State ==========
    messages: [],
    isStreaming: false,
    
    // ========== Actions ==========
    addMessage: (message) => {
      set((state) => ({
        messages: [...state.messages, message],
      }), false, 'addMessage');
    },
    
    // ...
  }))
);
```

---

## 🧱 文件结构优化（关键规则）

### 合并策略（非常重要）

如果遇到以下情况，**必须进行合并**：

- ✅ 小组件 / 小组件
- ✅ 仅被单一地方使用
- ✅ 代码非常碎片化
- ✅ 文件数量过多影响阅读

### 合并原则

- ✅ **相关逻辑聚合在一起**
- ✅ **提高可读性 > 过度拆分**
- ✅ **以"功能"为单位，而不是"类型"为单位**

### ❗ 禁止过度拆分

- ❌ 不要为了"规范"强行拆很多文件
- ❌ 不要把一个简单逻辑拆成多个文件
- ❌ 不要引入过多抽象层

### 推荐结构

#### 小型组件（合并）

```typescript
// InputArea.tsx - 包含所有相关逻辑

// 1. 主组件
export function InputArea() { ... }

// 2. 子组件（仅在此处使用）
function ToolbarButton() { ... }

// 3. 类型定义
interface InputAreaProps { ... }

// 4. 辅助函数
function formatText(text: string) { ... }
```

#### 中型组件（适度拆分）

```
InputArea/
├── InputArea.tsx          # 主组件
├── InputArea.module.css   # 样式
├── useInputArea.ts        # 复杂逻辑 Hook
└── types.ts               # 类型定义（共享时）
```

#### 大型功能（Feature-based）

```
chat/
├── components/            # UI 组件
│   ├── ChatPanel.tsx
│   ├── InputArea.tsx
│   └── MessageList.tsx
├── hooks/                 # 业务逻辑
│   ├── useChatPanel.ts
│   └── useInputArea.ts
├── stores/                # 状态管理
│   ├── chatStore.ts
│   └── modalStore.ts
├── services/              # API 服务
│   └── chatApi.ts
└── types/                 # 类型定义
    └── chat.ts
```

---

## 🎨 样式规范

### 基本原则

| 场景 | 推荐方案 | 示例 |
|------|----------|------|
| 简单组件 | 内联样式或 CSS Modules | `styles.container` |
| 复杂组件 | 独立样式文件 | `Component.module.css` |
| 全局样式 | 主题变量 + CSS 变量 | `:root { --primary-color }` |
| 动态样式 | 条件类名 | `className={isActive ? styles.active : ''}` |

### 样式文件组织

```css
/* Component.module.css */

/* ========== Layout ========== */
.container { ... }
.header { ... }
.content { ... }

/* ========== Components ========== */
.button { ... }
.buttonPrimary { ... }
.buttonDisabled { ... }

/* ========== States ========== */
.loading { ... }
.error { ... }
.empty { ... }

/* ========== Responsive ========== */
@media (max-width: 768px) { ... }
```

### 命名规范

- ✅ 使用 camelCase
- ✅ 语义化命名
- ❌ 避免缩写

```css
/* ✅ 好的命名 */
.messageContainer { ... }
.sendButton { ... }
.userAvatar { ... }

/* ❌ 不好的命名 */
.msg-ctr { ... }      /* 缩写 */
.btn { ... }          /* 过于简短 */
.wrapper { ... }      /* 无意义 */
```

---

## 🧾 SVG 处理规范

### 决策流程

```
SVG 图标
    │
    ├── 简单图标（< 10 个 path）
    │       └── 内联 JSX 或组件化
    │
    └── 复杂图标（>= 10 个 path）
            └── 独立文件导入
```

### 简单图标（内联）

```typescript
// 直接内联在组件中
function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22 2L11 13" stroke="currentColor" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" />
    </svg>
  );
}
```

### 复杂图标（独立文件）

```typescript
// assets/icons/ComplexIcon.tsx
export function ComplexIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props}>
      {/* 复杂 SVG 内容 */}
    </svg>
  );
}

// 组件中使用
import { ComplexIcon } from './assets/icons/ComplexIcon';
```

### 图标库管理

```
src/
├── components/
│   └── icons/              # 图标组件库
│       ├── index.ts        # 统一导出
│       ├── SendIcon.tsx
│       ├── CloseIcon.tsx
│       └── FolderIcon.tsx
```

---

## 📦 输出要求

### 重构后代码必须满足

- ✅ 输出完整重构后的代码
- ✅ 保持功能完全一致
- ✅ 结构清晰、易读、易维护
- ✅ 符合本文档所有规范
- ✅ 不需要解释，只输出代码（除非特别要求）

### 自检清单

提交前检查：

- [ ] 业务逻辑未改变
- [ ] 功能行为一致
- [ ] 数据流未改变
- [ ] 组件结构符合规范（State → Ref → Effects → Computed → Actions → Render）
- [ ] UI 状态命名统一
- [ ] 状态分层清晰（UI / Domain / Derived）
- [ ] 无过度拆分
- [ ] 代码可读性提升

---

## 📝 示例：重构前后对比

### 重构前 ❌

```typescript
// 混乱的顺序，混合的状态
function ChatInput() {
  const handleSend = () => { ... };  // Action 在最前
  
  const [text, setText] = useState('');  // State 在中间
  const messages = useStore(s => s.messages);
  
  useEffect(() => { ... }, []);  // Effect 在最后
  
  const ref = useRef(null);  // Ref 分散
  
  const filtered = useMemo(() => ...);  // Computed 穿插
  
  return ...;
}
```

### 重构后 ✅

```typescript
function ChatInput() {
  // 1. State
  const [inputText, setInputText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messages = useChatStore((s) => s.messages);
  
  // 2. Ref
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 3. Effects
  useEffect(() => {
    autoResizeTextarea();
  }, [inputText]);
  
  // 4. Computed
  const charCount = useMemo(() => inputText.length, [inputText]);
  const isOverLimit = charCount > MAX_LENGTH;
  
  // 5. Actions
  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
  }, []);
  
  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  }, [inputText]);
  
  // 6. Render
  return (
    <div ref={containerRef} className={styles.container}>
      <textarea
        ref={textareaRef}
        value={inputText}
        onChange={handleChange}
        className={isOverLimit ? styles.error : ''}
      />
      <button onClick={handleSend} disabled={isOverLimit}>
        Send ({charCount})
      </button>
    </div>
  );
}
```

---

## 🔗 相关文档

- [DEVELOPMENT.md](./DEVELOPMENT.md) - 开发规范
- [FEATURES.md](./FEATURES.md) - 功能规范
- [CHANGELOG.md](./CHANGELOG.md) - 变更记录

---

**最后更新**: 2026-04-08  
**维护者**: Frontend Architecture Team
