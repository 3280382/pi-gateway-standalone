# Pi Gateway Web UI 设计文档

## 设计目标

打造一个现代化、移动端友好的 Chat 界面，完整支持 Pi SDK 的所有 slash 命令。

## 核心特性

### 1. 响应式布局

```
桌面端 (>=1024px):
┌─────────────────────────────────────────────────────────────┐
│  Header (Session ID, Model, Settings)                      │
├──────────┬────────────────────────────────────────────────┤
│          │                                                │
│ Sidebar  │     Chat Area (Messages + Input)               │
│ (Collapsible)│                                            │
│          │                                                │
│ - Sessions│     ┌─────────────────────────────┐           │
│ - Settings│     │  Messages                   │           │
│ - Tools   │     │  ┌───┐ ┌───┐ ┌───┐        │           │
│          │     │  │AI │ │User│ │AI │        │           │
│          │     │  └───┘ └───┘ └───┘        │           │
│          │     └─────────────────────────────┘           │
│          │     ┌─────────────────────────────┐           │
│          │     │  Input Area (/ commands)    │           │
│          │     │  [Textarea        ] [Send]  │           │
│          │     └─────────────────────────────┘           │
└──────────┴────────────────────────────────────────────────┘

移动端 (<1024px):
┌─────────────────────────────────────┐
│  Header (Hamburger + Session ID)   │
├─────────────────────────────────────┤
│                                     │
│     Chat Area                       │
│     (Full width)                    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Messages                   │   │
│  │  ┌───┐ ┌───┐ ┌───┐        │   │
│  │  │AI │ │User│ │AI │        │   │
│  │  └───┘ └───┘ └───┘        │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Input Area                 │   │
│  │  [Textarea        ] [/] [Send]│  │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘

Slide-out Sidebar (Mobile):
┌────────┬────────────────────────────┐
│ Sidebar│                            │
│        │    Chat Area (dimmed)      │
│ X      │                            │
│        │                            │
│Sessions│                            │
│Settings│                            │
│Tools   │                            │
└────────┴────────────────────────────┘
```

### 2. Slash 命令完整支持

基于 Pi SDK 的 BUILTIN_SLASH_COMMANDS：

| 命令 | 功能 | Web 支持 | 实现方式 |
|------|------|----------|----------|
| `/compact` | 压缩上下文 | ✅ | `session.compact()` |
| `/export [path]` | 导出 HTML/JSONL | ✅ | `session.exportToHtml/Jsonl()` |
| `/session` | 显示会话信息 | ✅ | `session.getSessionStats()` |
| `/name <name>` | 设置会话名称 | ✅ | `session.setSessionName()` |
| `/copy` | 复制最后回复 | ✅ | `session.getLastAssistantText()` |
| `/clear` `/new` | 新建会话 | ✅ | `session.newSession()` |
| `/bash <cmd>` | 执行 Bash | ✅ | `session.executeBash()` |
| `/ls` `/cat` etc. | 常用命令 | ✅ | `session.executeBash()` |
| `/model` | 选择模型 | ✅ Web UI | 弹出模型选择器 |
| `/settings` | 设置菜单 | ✅ Web UI | 弹出设置面板 |
| `/login` `/logout` | OAuth 登录 | ✅ Web UI | 登录对话框 |
| `/fork` | 分支会话 | ✅ Web UI | 消息选择器 |
| `/tree` | 会话树 | ✅ Web UI | 树形导航 |
| `/import` | 导入会话 | ✅ | 文件上传 + `switchSession()` |
| `/share` | 分享为 Gist | ✅ | `exportToHtml()` + API |
| `/changelog` | 更新日志 | ✅ | 读取 changelog 文件 |
| `/hotkeys` | 快捷键 | ✅ | 显示帮助面板 |
| `/resume` | 恢复会话 | ✅ Web UI | 会话选择器 |
| `/reload` | 重新加载 | ✅ | 重新初始化 |
| `/quit` | 退出 | ❌ | 不适用 |

### 3. 移动端优化

#### Touch 优化
- 按钮最小 44x44px
- 滑动操作支持
- 底部固定输入框
- 键盘弹出时自动调整

#### 手势支持
- 左滑：打开 Sidebar
- 右滑：关闭 Sidebar
- 下拉：加载更多消息
- 长按：消息操作菜单

### 4. UI 组件设计

#### 主题系统
```css
:root {
  /* Colors */
  --bg-primary: #0d0d0d;
  --bg-secondary: #1a1a1a;
  --bg-tertiary: #262626;
  --text-primary: #ffffff;
  --text-secondary: #a0a0a0;
  --accent: #22c55e;
  --accent-hover: #16a34a;
  --error: #ef4444;
  --warning: #f59e0b;
  --info: #3b82f6;
  
  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  
  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 16px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
}
```

#### 组件规范

**消息气泡**
```
用户消息:
┌─────────────────────────────┐
│  ┌─────────────────────┐    │
│  │ 消息内容            │    │
│  │ 多行支持            │    │
│  └─────────────────────┘    │
│         时间戳              │
└─────────────────────────────┘

AI 消息:
┌─────────────────────────────┐
│  🤖                         │
│  ┌─────────────────────┐    │
│  │ 消息内容            │    │
│  │ 代码块支持          │    │
│  └─────────────────────┘    │
│  [复制] [重新生成]          │
└─────────────────────────────┘
```

**输入框**
```
桌面端:
┌─────────────────────────────────────────┐
│ [Textarea with auto-resize] [/] [Send]  │
└─────────────────────────────────────────┘

移动端:
┌────────────────────────────────────┐
│ [Textarea] [/] [Send]              │
└────────────────────────────────────┘
```

**Slash 命令菜单**
```
┌─────────────────────────────┐
│ /compact  - 压缩上下文      │
│ /export   - 导出会话        │
│ /session  - 会话信息        │
│ /bash     - 执行命令        │
│ ...                         │
└─────────────────────────────┘
```

### 5. 文件结构

```
src/client/
├── components/
│   ├── ui/                    # 基础 UI 组件
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Dropdown.tsx
│   │   └── Tooltip.tsx
│   ├── chat/
│   │   ├── ChatContainer.tsx  # 主容器
│   │   ├── MessageList.tsx    # 消息列表
│   │   ├── MessageItem.tsx    # 单个消息
│   │   ├── InputArea.tsx      # 输入区域
│   │   ├── SlashMenu.tsx      # 命令菜单
│   │   └── ToolExecution.tsx  # 工具执行显示
│   ├── sidebar/
│   │   ├── Sidebar.tsx        # 侧边栏
│   │   ├── SessionList.tsx    # 会话列表
│   │   ├── ModelSelector.tsx  # 模型选择器
│   │   └── SettingsPanel.tsx  # 设置面板
│   └── header/
│       ├── Header.tsx         # 顶部栏
│       └── StatusBar.tsx      # 状态显示
├── hooks/
│   ├── useChat.ts             # 聊天逻辑
│   ├── useSlashCommands.ts    # 命令处理
│   ├── useMobile.ts           # 移动端检测
│   └── useTheme.ts            # 主题管理
├── stores/
│   ├── chatStore.ts           # 聊天状态
│   ├── uiStore.ts             # UI 状态
│   └── settingsStore.ts       # 设置状态
└── styles/
    ├── variables.css          # CSS 变量
    ├── global.css             # 全局样式
    └── animations.css         # 动画
```

### 6. 实现阶段

#### Phase 1: 基础架构
- [ ] 创建设计系统 (CSS 变量、基础组件)
- [ ] 重构项目结构
- [ ] 实现响应式布局

#### Phase 2: 核心功能
- [ ] 消息列表优化
- [ ] 输入框重构 (支持 slash 命令)
- [ ] Sidebar 移动端适配

#### Phase 3: Slash 命令
- [ ] 实现所有 SDK 命令映射
- [ ] 创建命令菜单 UI
- [ ] 添加命令自动完成

#### Phase 4: 移动端优化
- [ ] Touch 手势支持
- [ ] 键盘适配
- [ ] 性能优化

#### Phase 5:  polish
- [ ] 动画效果
- [ ] 主题切换
- [ ] 无障碍支持

### 7. 技术栈

- **Framework**: React 18
- **State**: Zustand
- **Styling**: CSS Modules + CSS Variables
- **Icons**: Lucide React
- **Mobile**: CSS Media Queries + Touch Events
- **Animations**: CSS Transitions + Framer Motion

## 下一步行动

1. 创建基础设计系统
2. 重构 Chat 组件
3. 实现完整的 Slash 命令支持
