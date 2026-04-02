# Pi Gateway 功能规格

> **产品定位**: Pi Coding Agent 的 Web 网关，为开发者提供美观的 AI 聊天界面和文件管理功能。
> 
> **核心价值**: 在浏览器中实现与 AI 助手的自然对话，同时管理本地文件系统。

---

## 1. 界面架构

### 1.1 统一布局系统 (AppLayout)

所有视图共享统一的布局框架：

```
┌─────────────────────────────────────────────────────────────┐
│ Header (64px) - TopBar                                      │
│ ├─ Row1: [系统提示] [模型选择 ▼] [Thinking ▼] [状态 ● PID]  │
│ └─ Row2: [📁 工作目录]          [🔍 搜索框]                │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│ Sidebar  │  Content (主内容区)                              │
│ (可隐藏) │  ├─ contentBody                                  │
│ 280px    │  │   • Chat: MessageList (消息列表)              │
│          │  │   • Files: FileBrowser (文件浏览器)           │
│ 最近工作区│  │                                               │
│ 会话列表  │  └─ inputArea (输入框，仅 Chat 视图显示)        │
│ 设置      │                                                  │
├──────────┴──────────────────────────────────────────────────┤
│ Footer (44px) - BottomMenu                                  │
│ [← 侧边栏] [💬 Chat] [📁 Files] [↑ 底部面板]               │
├─────────────────────────────────────────────────────────────┤
│ BottomPanel (可弹出，overlay)                               │
│ ├─ 拖拽调整高度                                            │
│ ├─ 终端输出 (文件执行结果)                                  │
│ └─ 预览内容                                                │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 区域职责

| 区域 | 职责 | 高度/宽度 | 桌面端 | 移动端 |
|------|------|-----------|--------|--------|
| **Header** | 模型选择、Thinking级别、工作目录、搜索 | 64px | 固定顶部 | 固定顶部 (56px) |
| **Sidebar** | 最近工作区、会话列表、设置 | 280px | 左侧可隐藏 | 抽屉式覆盖 |
| **Content** | 主内容（消息列表/文件浏览器） | flex:1 | 右侧主区域 | 全宽 |
| **InputArea** | 聊天输入框 | auto | Content底部 | Content底部 |
| **Footer** | 视图切换、侧边栏控制 | 44px | 固定底部 | 固定底部 |
| **BottomPanel** | 终端/预览 | 可变 | 从Footer上方弹出 | 从Footer上方弹出 |

---

## 2. 核心功能

### 2.1 TopBar（顶部菜单）

#### Row 1 - 主要控制
| 功能 | 说明 | 状态 |
|------|------|------|
| 系统提示按钮 | 显示 AGENTS.md 和 SYSTEM 提示 | ✅ |
| 模型选择器 | 选择 AI 模型 (deepseek-chat 等) | ✅ |
| Thinking 级别 | None/Low/Med/High/XHigh | ✅ |
| 连接状态 | 绿色圆点 + PID 显示 | ✅ |

#### Row 2 - 工作目录和搜索
| 功能 | 说明 | 状态 |
|------|------|------|
| 工作目录按钮 | 点击打开目录选择器 | ✅ |
| 搜索框 | 搜索历史消息，支持过滤器 | ✅ |

---

### 2.2 Sidebar（侧边栏）

| 功能 | 说明 | 状态 |
|------|------|------|
| **Pi Gateway** | Logo 和标题 | ✅ |
| **Recent Workspaces** | 最近工作目录列表，快速切换 | ✅ |
| **Sessions** | 当前目录下的会话列表，点击加载 | ✅ |
| **Settings** | 设置分组 | ✅ |
| **Theme** | 深色/浅色主题切换 | ✅ |
| **Font** | 字体大小选择 | ✅ |
| **LLM Log** | LLM 日志开关 | ✅ |
| **Refresh** | 刷新间隔设置 | ✅ |

---

### 2.3 Chat 视图

#### MessageList（消息列表）
| 功能 | 说明 | 状态 |
|------|------|------|
| 消息显示 | 用户消息(灰色) / AI消息(白色) | ✅ |
| 流式输出 | 打字机效果，逐字显示 | ✅ |
| 代码高亮 | 支持多种语言的语法高亮 | ✅ |
| Thinking 块 | 黄色背景，可折叠 | ✅ |
| 工具调用 | 蓝色背景，显示工具名和参数 | ✅ |
| 消息操作 | 复制、删除、重新生成 | ✅ |
| 消息折叠 | 长按/点击折叠长消息 | ✅ |

#### InputArea（输入框）
| 功能 | 说明 | 状态 |
|------|------|------|
| 多行输入 | 支持多行文本，自动增高 | ✅ |
| @ 文件引用 | 点击 @ 按钮或输入 @ 触发文件选择器 | ✅ |
| / 斜杠命令 | 点击 / 按钮或输入 / 触发命令菜单 | ✅ |
| 发送按钮 | 飞机图标，发送消息 | ✅ |
| 停止按钮 | 流式输出时可停止 | ✅ |
| 新会话按钮 | 创建新会话 | ✅ |

---

### 2.4 Files 视图

#### FileBrowser（文件浏览器）
| 功能 | 说明 | 状态 |
|------|------|------|
| 目录浏览 | 点击目录进入，显示上级目录 (..) | ✅ |
| 实时加载 | 每次从服务器获取最新数据（无缓存） | ✅ |
| 文件网格 | 网格/列表视图切换 | ✅ |
| 批量操作 | 多选文件进行批量操作 | ✅ |
| 文件预览 | 文本文件预览，代码高亮 | ✅ |
| 文件编辑 | 内置编辑器，支持保存 | ✅ |
| 文件执行 | 在终端中执行脚本 | ✅ |

---

### 2.5 状态持久化

#### 前端持久化 (localStorage)
| 状态项 | 说明 |
|--------|------|
| currentDir | 当前工作目录 |
| currentSessionId | 当前会话 ID |
| currentModel | 当前选择的模型 |
| thinkingLevel | Thinking 级别 |
| theme | 主题设置 |
| recentWorkspaces | 最近工作区列表 |

#### 后端持久化 (Session File)
| 状态项 | 说明 |
|--------|------|
| 会话历史 | `.pi/sessions/` 下的 JSONL 文件 |
| 消息记录 | 包含所有消息和元数据 |
| 自动保存 | WebSocket 断开时自动保存 |

---

## 3. 工作流程

### 3.1 初始化流程

```
1. 前端加载
   ├─ 从 localStorage 恢复 currentDir, currentSessionId
   ├─ 显示加载状态
   └─ 连接 WebSocket

2. WebSocket 连接成功
   ├─ 发送 init 消息 (workingDir, sessionId)
   ├─ 后端启动 pi 进程
   ├─ 加载或创建 session 文件
   └─ 返回 sessionId, pid, model, thinkingLevel

3. 前端初始化完成
   ├─ 保存状态到 store
   ├─ 加载会话历史消息
   └─ 显示主界面
```

### 3.2 切换工作目录

```
1. 用户点击工作目录按钮
2. 打开目录选择器 (DirectoryPicker)
3. 选择新目录
4. 发送 change_dir 消息到后端
5. 后端 dispose 当前 session
6. 在新目录启动新的 pi 进程
7. 返回新的 sessionId 和 pid
8. 前端更新状态，加载新会话
```

### 3.3 视图切换

```
Chat 视图 → Files 视图:
├─ 隐藏 InputArea
├─ 显示 FileBrowser
└─ 底部面板显示文件执行终端

Files 视图 → Chat 视图:
├─ 显示 InputArea
├─ 显示 MessageList
└─ 底部面板显示普通终端
```

---

## 4. 技术实现

### 4.1 布局实现

```typescript
// AppLayout.tsx - 统一布局
<div className={styles.layout}>
  <header className={styles.header}><TopBar /></header>
  <div className={styles.body}>
    <aside className={styles.sidebar}><SidebarPanel /></aside>
    <main className={styles.content}>
      <div className={styles.contentBody}>{children}</div>
      {showInput && <div className={styles.inputArea}><InputArea /></div>}
    </main>
  </div>
  <footer className={styles.footer}><BottomMenu /></footer>
  {isBottomPanelOpen && <div className={styles.bottomPanel}>...</div>}
</div>
```

### 4.2 状态管理

```typescript
// LayoutContext - 布局状态
{
  currentView: 'chat' | 'files',
  isSidebarVisible: boolean,
  isBottomPanelOpen: boolean,
  bottomPanelHeight: number,
}

// sessionStore (persisted) - 用户设置
{
  currentDir: string,
  currentSessionId: string | null,
  currentModel: string,
  thinkingLevel: ThinkingLevel,
}
```

---

## 5. 响应式适配

### 断点
- **Desktop**: > 768px - 完整布局
- **Tablet**: 768px - 侧边栏自动隐藏
- **Mobile**: < 768px - 抽屉式侧边栏，简化顶部菜单

### 移动端适配
- 顶部菜单高度从 64px 减为 56px
- 侧边栏变为抽屉式，从左侧滑出
- 底部菜单始终显示
- 触摸优化：更大的点击区域
