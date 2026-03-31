# Pi Gateway - UI 功能布局规范

> **版本**: 1.0.0  
> **日期**: 2026-03-30  
> **描述**: Pi Coding Agent Web 网关的完整 UI 功能布局结构化规范文档

---

## 目录

1. [应用概述](#应用概述)
2. [架构原则](#架构原则)
3. [布局层级结构](#布局层级结构)
4. [主要布局区域](#主要布局区域)
5. [交互模式与状态流转](#交互模式与状态流转)
6. [响应式设计](#响应式设计)
7. [数据流与 API](#数据流与-api)
8. [视觉设计规范](#视觉设计规范)
9. [可访问性与键盘导航](#可访问性与键盘导航)
10. [错误处理](#错误处理)

---

## 应用概述

| 属性 | 值 |
|------|-----|
| **应用名称** | Pi Gateway |
| **定位** | Pi Coding Agent 的 Web 网关 |
| **核心功能** | AI 聊天界面 + 文件管理系统 |
| **技术栈** | React 19 + TypeScript + Vite + Zustand + CSS Modules |

---

## 架构原则

### 核心设计原则

1. **统一布局系统 (AppLayout)**
   - 所有视图共享相同的布局框架
   - 布局行为全部由 `AppLayout` 控制
   - 子组件只负责内容渲染，不参与布局

2. **布局与内容分离**
   - `AppLayout` 控制组件位置和尺寸
   - 子组件通过 `children` 传入，专注内容渲染
   - 布局样式集中在 `AppLayout.module.css`

3. **状态分层管理**
   
   | 层级 | 存储方式 | 用途 | 持久化 |
   |------|----------|------|--------|
   | `LayoutContext` | React Context | 运行时 UI 状态（侧边栏、面板） | ❌ |
   | `sessionStore` | Zustand + Persist | 用户设置（目录、模型、主题） | ✅ localStorage |
   | `chatStore` | Zustand | 临时聊天状态（消息、流式） | ❌ |
   | `fileStore` | Zustand | 文件浏览器状态 | ❌ |

4. **响应式优先**
   - Desktop (>768px): 完整布局，侧边栏可停靠
   - Mobile (<768px): 抽屉式侧边栏，简化菜单

---

## 布局层级结构

### Z-Index 层级

```
┌─────────────────────────────────────────┐
│ Z-40: Toast Notifications               │
├─────────────────────────────────────────┤
│ Z-30: Modals, DirectoryPicker           │
├─────────────────────────────────────────┤
│ Z-20: Dropdown Menus, Tooltips          │
├─────────────────────────────────────────┤
│ Z-10: SidebarOverlay (覆盖模式)          │
├─────────────────────────────────────────┤
│ Z-0:  Base Layout, Content, Sidebar     │
└─────────────────────────────────────────┘
```

---

## 主要布局区域

### 1. Header (顶部菜单) - TopBar

**尺寸**: 65px (Desktop) / 57px (Mobile)  
**位置**: 固定顶部

#### Row 1 - 主要控制行 (32px)

| 组件 | 类型 | 功能 | 交互 |
|------|------|------|------|
| **SystemPromptButton** | Icon Button | 查看 AGENTS.md 和 SYSTEM 提示 | 打开 SystemPromptModal |
| **ModelSelector** | Dropdown | 选择 AI 模型 | 从 `/api/models` 获取列表，WebSocket 发送 `model_change` |
| **ThinkingLevelSelector** | Dropdown | 设置思考深度 | 5 个级别: None → XHigh，WebSocket 发送 `thinking_level_change` |
| **ConnectionStatus** | Status Indicator | 显示连接状态和 PID | 绿点(connected) / 红点(disconnected) / 黄点(connecting) |

**Thinking 级别定义**:

| ID | 名称 | 图标 |
|----|------|------|
| `off` | None | ○ |
| `minimal` | Low | ◐ |
| `low` | Med | ◑ |
| `medium` | High | ◒ |
| `high` | XHigh | ● |

#### Row 2 - 工作目录与搜索行 (32px)

| 组件 | 类型 | 功能 | 显示 |
|------|------|------|------|
| **WorkingDirectoryButton** | Text Button | 打开目录选择器 | 显示路径最后 2 级 (`.../parent/current`) |
| **SearchBox** | Search Input | 搜索历史消息 | 实时搜索 + 过滤器面板 |

**搜索过滤器**:
- User (用户消息)
- Assistant (AI 消息)
- Thinking (思考块)
- Tools (工具调用)

#### 弹窗组件

**DirectoryPicker** (目录选择器)

```yaml
触发: WorkingDirectoryButton 点击
结构:
  - header: "Select Working Directory"
  - current_path: 可点击导航
  - action_button: "Select This Directory"
  - entries_list: 只显示目录 (包含上级目录 ..)
行为:
  - 选择新目录时，后端 dispose 当前 session
  - 在新目录启动新的 pi 进程
  - 返回新的 sessionId 和 pid
```

**SystemPromptModal** (系统提示查看器)

```yaml
触发: SystemPromptButton 点击
内容区域:
  - AGENTS.md Files: 显示找到的 agents 文件列表及内容
  - SYSTEM Prompt: 系统提示词完整内容
  - Skills: 可用技能列表 (前 10 个 + 计数)
```

---

### 2. Sidebar (侧边栏) - SidebarPanel

**尺寸**: 280px (Desktop) / 100% 抽屉 (Mobile)  
**位置**: 左侧覆盖 (覆盖 Header 和 Content，不覆盖 Footer)

#### 结构

```
┌─────────────────────────────┐
│  Header                     │
│  [π] Pi Gateway             │
├─────────────────────────────┤
│  RecentWorkspaces           │
│  [folder] workspace-name    │
│  [folder] another-project   │
├─────────────────────────────┤
│  Sessions              [+]  │
│  [msg] session-name         │
│  2024-01-15 • 24 msgs       │
├─────────────────────────────┤
│  Settings                   │
│  Theme: [🌙] [☀️]           │
│  Font: [A] [A] [A] [A]      │
│  LLM Log: [On] [View]       │
└─────────────────────────────┘
```

#### 区块详情

**RecentWorkspaces** (最近工作区)

| 属性 | 值 |
|------|-----|
| 数据源 | `sessionStore.recentWorkspaces` (localStorage) |
| 最大数量 | 5 |
| 显示格式 | `folder icon` + `目录名` + `完整路径(tooltip)` |
| 操作 | 点击切换工作目录，清除全部 |

**Sessions** (会话列表)

| 属性 | 值 |
|------|-----|
| 数据源 | `GET /api/sessions?cwd={workingDir}` |
| 操作 | 新建会话 (+按钮)，加载会话 (点击) |
| 显示格式 | `msg icon` + `会话名` + `日期 • 消息数` |

**Settings** (设置)

| 设置项 | 类型 | 选项 |
|--------|------|------|
| Theme | Button Group | 🌙 Dark / ☀️ Light |
| Font Size | Button Group | A(tiny) A(small) A(medium) A(large) |
| LLM Log | Toggle + Button | On/Off + View 按钮 |
| Refresh | Select | 1s / 5s / 10s / 30s / 1m |

---

### 3. Content (主内容区)

**Flex**: 1 (占据剩余空间)  
**Overflow**: auto

#### 3.1 Chat 视图

**组件**: `MessageList` + `InputArea`

##### MessageList (消息列表)

**空状态**:
```
[π]
Welcome to Pi Gateway
Start a conversation below
```

**消息渲染**:

| 消息类型 | 背景色 | 内容块 |
|----------|--------|--------|
| User | Gray | Text only |
| Assistant | White/Transparent | Thinking + Tools + Text |

**Assistant 消息内容块**:

1. **ThinkingBlock** (思考块)
   - 条件: `content.type === 'thinking'`
   - 样式: 黄色背景 (`rgba(240, 136, 62, 0.1)`)
   - 可折叠: 默认折叠
   - 显示控制: `chatStore.showThinking`

2. **ToolBlock** (工具块)
   - 条件: `content.type === 'tool'`
   - 样式: 蓝色背景 (`rgba(88, 166, 255, 0.1)`)
   - 状态图标: ◐ executing / ✓ success / ✗ error
   - 内容: 工具名 + 参数(JSON) + 输出 + 错误

3. **TextBlock** (文本块)
   - Markdown 渲染
   - 代码语法高亮
   - 流式打字效果

**消息操作** (悬停显示):
- Regenerate (重新生成，仅 AI 消息)
- Delete (删除)
- Collapse (折叠/展开)

**自动滚动**:
- 新消息/流式内容自动滚动到底部
- 用户向上滚动超过 50px 时暂停自动滚动

##### InputArea (输入区域)

**特性**:
- 多行文本框，自动增高 (最小 1 行，最大 200px)
- 占位符: "Message..." / "Generating..." / "Enter bash command..."

**模式指示器**:
- Bash 模式: 前缀 `!` 显示终端图标
- 斜杠命令: 前缀 `/` 显示命令菜单

**斜杠命令菜单** (27 个命令):

| 类别 | 命令 |
|------|------|
| Session | `/new`, `/clear`, `/save`, `/load`, `/export` |
| Context | `/context`, `/agents`, `/system`, `/skills`, `/prompt`, `/compact`, `/model`, `/think`, `/dir`, `/log` |
| Tools | `/bash`, `/read`, `/write`, `/edit`, `/ls`, `/grep`, `/tree`, `/git` |
| Help | `/help`, `/shortcuts`, `/theme`, `/font` |

**导航**: ArrowUp/ArrowDown + Enter 选择

**发送按钮**:
- 空闲: 纸飞机图标 (Send)
- 流式中: 方块图标 (Stop)

**键盘快捷键**:

| 快捷键 | 功能 |
|--------|------|
| Enter | 发送消息 (非 Bash 模式) |
| Shift+Enter | 换行 |
| Ctrl/Cmd+Enter | 发送消息 (所有模式) |
| Escape | 关闭命令菜单 / 停止生成 |

#### 3.2 Files 视图

**组件**: `FileBrowser`

**布局**:
```
┌─────────────────┬──────────────────────────────────┐
│ FileSidebar     │ FileToolbar                      │
│ (目录树)         │ [breadcrumb] [grid/list] [sort]  │
│                 │ [filter] [search] [refresh]      │
│                 ├──────────────────────────────────┤
│                 │ FileActionBar (选中时显示)        │
│                 │ [Execute] [Delete] [Rename]      │
│                 ├──────────────────────────────────┤
│                 │ FileList / FileGrid              │
│                 │ [icon] filename.ext              │
│                 │ size / modified                  │
│                 └──────────────────────────────────┘
```

**FileSidebar** (目录树):
- 可显示/隐藏
- 异步加载目录结构

**FileToolbar** (工具栏):
- 面包屑导航
- 视图切换: Grid / List
- 排序: time-desc, time-asc, name-asc, name-desc, type, size-desc, size-asc
- 过滤: all, dir, text, html, js, py, sh, java, json, md, image, code, media, doc
- 搜索: 文件名过滤
- 刷新: 重新加载目录

**FileActionBar** (操作栏):
- 条件: 有选中文件时显示
- 操作: Execute, Delete, Rename, Download

**FileList/FileGrid** (文件列表):
- 显示: 图标 (基于文件类型) + 文件名 + 元信息
- 交互: 单击选择/打开，双击打开，右键菜单
- 空状态: Loading... / Error / No files found

**FileViewer** (文件查看器 - Modal):
- 文本预览 + 代码高亮
- 编辑模式 + 保存

---

### 4. Footer (底部菜单) - BottomMenu

**尺寸**: 44px  
**位置**: 固定底部

**布局**: `flexbox` - LeftGroup (固定) + CenterGroup (自动)

#### LeftGroup

| 按钮 | 图标 | 功能 |
|------|------|------|
| SidebarToggle | ◀ (显示) / ▶ (隐藏) | 切换侧边栏 |
| BottomPanelToggle | ▲ (关闭) / ▼ (打开) | 切换底部面板 |

#### CenterGroup

| 按钮 | 图标 | 功能 | 激活状态 |
|------|------|------|----------|
| ChatView | 💬 | 切换到 Chat 视图 | `currentView === 'chat'` |
| FilesView | 📁 | 切换到 Files 视图 | `currentView === 'files'` |

---

### 5. BottomPanel (底部弹出面板)

**位置**: Footer 上方覆盖层  
**默认高度**: 200px (范围: 100px - 500px)  
**可调整**: 顶部拖拽手柄

**内容类型**:
- Terminal: 命令行输出 / 文件执行结果
- Preview: 文件预览

**控制**:
- 拖拽手柄调整高度
- × 按钮关闭面板

---

## 交互模式与状态流转

### 1. 初始化流程

```
┌─────────────┐     ┌─────────────────────────────┐
│   1. 启动    │────▶│ 从 localStorage 恢复状态      │
└─────────────┘     │ (currentDir, currentSessionId)│
                    └─────────────┬───────────────┘
                                  ▼
┌─────────────┐     ┌─────────────────────────────┐
│   2. 显示    │────▶│ 显示 Loading... 状态         │
└─────────────┘     └─────────────┬───────────────┘
                                  ▼
┌─────────────┐     ┌─────────────────────────────┐
│   3. 连接    │────▶│ 建立 WebSocket 连接          │
└─────────────┘     └─────────────┬───────────────┘
                                  ▼
┌─────────────┐     ┌─────────────────────────────┐
│   4. 初始化  │────▶│ 发送 init 消息               │
└─────────────┘     │ {workingDir, sessionId?}      │
                    └─────────────┬───────────────┘
                                  ▼
┌─────────────┐     ┌─────────────────────────────┐
│   5. 后端    │────▶│ 启动 pi 进程                 │
│     处理     │     │ 加载/创建 session 文件        │
└─────────────┘     └─────────────┬───────────────┘
                                  ▼
┌─────────────┐     ┌─────────────────────────────┐
│   6. 响应    │────▶│ 接收 initialized 响应        │
└─────────────┘     │ {sessionId, pid, model, ...} │
                    └─────────────┬───────────────┘
                                  ▼
┌─────────────┐     ┌─────────────────────────────┐
│   7. 完成    │────▶│ 保存状态，加载历史消息        │
└─────────────┘     │ 显示主界面                    │
                    └─────────────────────────────┘
```

### 2. 切换工作目录流程

| 步骤 | 动作 | 说明 |
|------|------|------|
| 1 | 用户选择新目录 | 通过 DirectoryPicker 或 RecentWorkspaces |
| 2 | 发送消息 | WebSocket `change_dir` |
| 3 | 后端处理 | dispose 当前 session (自动保存) |
| 4 | 启动新进程 | 在新目录启动新的 pi 进程 |
| 5 | 返回新状态 | 新的 sessionId 和 pid |
| 6 | 前端更新 | 更新 sessionStore，重新加载消息 |

### 3. 视图切换

**Chat → Files**:
- `currentView = 'files'`
- `showInput = false`
- 显示 FileBrowser
- 底部面板切换为文件执行终端

**Files → Chat**:
- `currentView = 'chat'`
- `showInput = true`
- 显示 MessageList
- 底部面板切换为普通终端

### 4. 消息发送流程

| 阶段 | 操作 | Store 状态变化 |
|------|------|----------------|
| 1 | 用户输入 + 发送 | - |
| 2 | 开始流式 | `startStreaming()` - 创建临时消息 |
| 3 | WebSocket 发送 | `send('prompt', {text})` |
| 4 | 接收 chunk | `appendStreamingContent(chunk)` |
| 5 | 完成 | `finishStreaming()` - 添加到 messages |

---

## 响应式设计

### 断点定义

| 断点 | 宽度 | 侧边栏行为 | Header 高度 |
|------|------|-----------|-------------|
| Desktop | >768px | Docked (可隐藏) | 65px |
| Mobile | ≤768px | Drawer (全宽覆盖) | 57px |

### 适配规则

**Sidebar**:
- Desktop: 固定宽度 280px，可折叠，与内容并排
- Mobile: 抽屉模式，从左侧滑出，覆盖内容区域

**TopBar**:
- Desktop: 两行布局，所有控件可见
- Mobile: 简化布局，部分控件可能隐藏或折叠

**InputArea**:
- 功能保持一致
- Mobile 触控优化：更大的点击区域

---

## 数据流与 API

### REST API

| 端点 | 方法 | 请求体 | 响应 |
|------|------|--------|------|
| `/api/models` | GET | - | `[{id, name, provider}]` |
| `/api/browse` | POST | `{path}` | `{currentPath, parentPath, items[]}` |
| `/api/sessions` | GET | `?cwd={path}` | `{sessions: [{id, name, path, messageCount, lastModified}]}` |
| `/api/session/load` | POST | `{sessionPath}` | `{entries: [...]}` |
| `/api/execute` | POST | `{path}` | `stdout/stderr` |

### WebSocket 消息

**Client → Server**:

| 消息类型 | payload | 说明 |
|----------|---------|------|
| `init` | `{workingDir, sessionId?}` | 初始化会话 |
| `prompt` | `{text}` | 发送消息 |
| `abort` | `{}` | 中止生成 |
| `change_dir` | `{path}` | 切换工作目录 |
| `new_session` | `{}` | 创建新会话 |
| `load_session` | `{sessionPath}` | 加载会话 |
| `model_change` | `{provider, modelId}` | 切换模型 |
| `thinking_level_change` | `{thinkingLevel}` | 切换思考级别 |

**Server → Client**:

| 消息类型 | payload | 说明 |
|----------|---------|------|
| `initialized` | `{sessionId, sessionFile, workingDir, model, thinkingLevel, systemPrompt, agentsFiles, skills, pid}` | 初始化完成 |
| `dir_changed` | `{success, sessionId, pid}` | 目录切换完成 |
| `session_loaded` | `{success}` | 会话加载完成 |
| `message_chunk` | `{content, type}` | 流式消息片段 |
| `tool_execution` | `{toolCallId, toolName, args, status}` | 工具执行状态 |
| `error` | `{message}` | 错误消息 |

---

## 视觉设计规范

### 深色主题配色

| Token | 色值 | 用途 |
|-------|------|------|
| `--bg-primary` | `#0d1117` | 主背景 |
| `--bg-secondary` | `#161b22` | 次级背景 |
| `--bg-tertiary` | `#21262d` | 三级背景 |
| `--text-primary` | `#c9d1d9` | 主文本 |
| `--text-secondary` | `#8b949e` | 次级文本 |
| `--border` | `#30363d` | 边框 |
| `--accent` | `#58a6ff` | 强调色 |
| `--success` | `#238636` | 成功 |
| `--warning` | `#f0883e` | 警告 |
| `--danger` | `#f85149` | 危险/错误 |
| `--thinking-bg` | `rgba(240, 136, 62, 0.1)` | 思考块背景 |
| `--tool-bg` | `rgba(88, 166, 255, 0.1)` | 工具块背景 |

### 字体规范

| Token | 值 |
|-------|-----|
| Font Family | `system-ui, -apple-system, sans-serif` |
| Tiny | `12px` |
| Small | `14px` |
| Medium | `16px` |
| Large | `18px` |
| XLarge | `20px` |

### 间距规范

| Token | 值 |
|-------|-----|
| XS | `4px` |
| SM | `8px` |
| MD | `12px` |
| LG | `16px` |
| XL | `24px` |
| XXL | `32px` |

---

## 可访问性与键盘导航

### 全局快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl/Cmd + B` | 切换侧边栏 |
| `Ctrl/Cmd + J` | 切换底部面板 |
| `Ctrl/Cmd + 1` | 切换到 Chat 视图 |
| `Ctrl/Cmd + 2` | 切换到 Files 视图 |
| `Ctrl/Cmd + K` | 打开命令面板 |

### 输入框快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 发送消息 |
| `Shift + Enter` | 换行 |
| `Ctrl/Cmd + Enter` | 发送消息 |
| `Escape` | 关闭命令菜单 / 停止生成 |
| `ArrowUp/Down` | 命令菜单导航 |

### 可访问性特性

- 所有按钮有 `aria-label`
- 颜色对比度符合 WCAG AA 标准
- 支持键盘完全操作
- 屏幕阅读器友好
- 焦点状态可见

---

## 错误处理

### 错误边界

| 边界组件 | 包裹内容 |
|----------|----------|
| `FileBrowserErrorBoundary` | FileBrowser 子组件 |
| `ErrorBoundary` | 全局错误边界 |

### 错误状态

| 错误类型 | 显示消息 | 建议操作 |
|----------|----------|----------|
| Network Error | "Network error: Cannot connect to server" | 检查连接后重试 |
| Permission Denied | "Permission denied: Cannot access..." | 检查文件权限 |
| Directory Not Found | "Directory not found: ..." | 确认路径存在 |

### 加载状态

| 状态 | 显示 |
|------|------|
| Skeleton | 内容加载前的骨架屏 |
| Spinner | 操作进行中的加载指示器 |
| Progress | 长时间操作的进度条 |

---

## 附录

### 文件结构映射

```
src/client/
├── components/
│   ├── layout/
│   │   ├── AppLayout/          # 统一布局控制器
│   │   │   ├── AppLayout.tsx
│   │   │   ├── LayoutContext.tsx
│   │   │   └── AppLayout.module.css
│   │   ├── TopBar/             # 顶部菜单
│   │   ├── BottomMenu/         # 底部菜单
│   │   ├── SidebarPanel/       # 侧边栏容器
│   │   └── sections/           # 侧边栏区块
│   │       ├── RecentWorkspaces/
│   │       ├── Sessions/
│   │       └── Settings/
│   ├── chat/
│   │   ├── MessageList/        # 消息列表
│   │   ├── MessageItem/        # 单条消息
│   │   └── InputArea/          # 输入区域
│   ├── files/
│   │   ├── FileBrowser.tsx     # 文件浏览器主组件
│   │   ├── FileSidebar.tsx     # 文件树侧边栏
│   │   ├── FileToolbar.tsx     # 工具栏
│   │   ├── FileList.tsx        # 列表视图
│   │   ├── FileGrid.tsx        # 网格视图
│   │   └── FileViewer.tsx      # 文件查看器
│   └── commands/
│       └── slashCommands.ts    # 27 个斜杠命令定义
├── stores/
│   ├── sessionStore.ts         # 持久化用户设置
│   ├── chatStore.ts            # 临时聊天状态
│   ├── fileStore.ts            # 文件浏览器状态
│   └── uiStore.ts              # UI 状态
└── services/
    └── websocket.service.ts    # WebSocket 客户端
```

---

*文档生成时间: 2026-03-30*  
*适用于: Pi Gateway Standalone v1.0+*
