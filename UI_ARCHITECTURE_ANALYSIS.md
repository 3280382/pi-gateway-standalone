# 界面架构分析与重构方案

## 当前架构分析

### 1. 目录结构现状

```
src/client/
├── components/
│   ├── chat/           # 聊天功能组件
│   │   ├── ChatPanel/
│   │   ├── InputArea/
│   │   ├── MessageItem/
│   │   └── MessageList/
│   ├── commands/       # 命令面板（空？）
│   ├── example/        # 示例组件（应删除）
│   ├── files/          # 文件浏览器组件
│   ├── layout/         # 布局组件
│   │   ├── AppLayout/      # 主布局
│   │   ├── BottomMenu/     # 底部菜单
│   │   ├── SidebarPanel/   # 侧边栏
│   │   ├── TopBar/         # 顶部栏
│   │   └── sections/       # 侧边栏分区
│   ├── llm-log/        # LLM日志面板
│   ├── modals/         # 模态框集合
│   ├── search/         # 搜索组件
│   ├── terminal/       # 终端面板
│   ├── test/           # 测试组件（？）
│   └── ui/             # 基础UI组件
├── pages/              # 页面组件
│   ├── ChatPage.tsx
│   ├── FilesPage.tsx
│   ├── LoadingScreen.tsx
│   └── ErrorScreen.tsx
├── hooks/              # 自定义Hooks
├── stores/             # 状态管理
└── services/           # 服务层
```

### 2. 当前问题

#### 问题1: 混合组织方式
- 既有按功能划分（chat/, files/），又有按类型划分（modals/, ui/）
- layout/ 目录混杂了全局布局和业务组件（sections/）

#### 问题2: 层级不清晰
- AppLayout 同时负责布局框架和聊天滚动逻辑
- TopBar 过于复杂（900+行），包含 DirectoryPicker 组件定义
- 页面组件（pages/）和布局组件（components/layout/）边界模糊

#### 问题3: 命名不一致
- 有些目录使用 PascalCase (ChatPanel/)，有些使用 camelCase (sections/)
- index.ts 导出方式不统一

#### 问题4: 重复和冗余
- example/ 目录应该删除
- commands/ 目录如果为空应删除
- test/ 目录命名不明确

---

## 行业规范分析

### 主流 React 项目结构对比

#### 1. Feature-Based 结构 (推荐)
```
src/
├── features/           # 按功能域组织
│   ├── chat/
│   ├── files/
│   └── settings/
├── shared/            # 共享资源
│   ├── components/    # 通用UI组件
│   ├── hooks/
│   └── utils/
├── app/               # 应用级组件
│   ├── layout/
│   └── providers/
└── pages/             # 页面路由
```

#### 2. Atomic Design 结构
```
src/
├── components/
│   ├── atoms/         # 原子组件（Button, Input）
│   ├── molecules/     # 分子组件（SearchBar）
│   ├── organisms/     # 有机体（Header, Sidebar）
│   ├── templates/     # 模板（PageLayout）
│   └── pages/         # 页面
```

#### 3. Next.js App Router 结构
```
src/
├── app/               # 路由定义
│   ├── layout.tsx     # 根布局
│   ├── page.tsx       # 首页
│   └── (chat)/        # 路由组
├── components/        # React组件
├── lib/              # 工具函数
└── hooks/            # 自定义Hooks
```

---

## 重构方案

### 目标架构：混合模式 (Feature + Shared)

```
src/client/
│
├── app/                          # 应用核心层
│   ├── layout/                   # 全局布局组件
│   │   ├── AppLayout.tsx         # 主布局框架
│   │   ├── AppHeader.tsx         # 应用头部（原TopBar简化）
│   │   ├── AppFooter.tsx         # 应用底部（原BottomMenu）
│   │   ├── AppSidebar.tsx        # 应用侧边栏容器
│   │   └── MainContent.tsx       # 主内容区容器
│   ├── providers/                # 全局Provider
│   │   ├── LayoutProvider.tsx    # 布局上下文
│   │   └── AppProviders.tsx      # 统一Provider包装
│   └── navigation/               # 导航组件
│       ├── ViewSwitcher.tsx      # 视图切换
│       └── NavItem.tsx           # 导航项
│
├── features/                     # 功能域（按业务划分）
│   ├── chat/                     # 聊天功能域
│   │   ├── components/           # 聊天专用组件
│   │   │   ├── MessageList/
│   │   │   ├── MessageItem/
│   │   │   ├── InputArea/
│   │   │   └── ChatPanel/
│   │   ├── hooks/                # 聊天专用hooks
│   │   │   └── useChat.ts
│   │   ├── stores/               # 聊天状态（从全局迁移）
│   │   │   └── chatStore.ts
│   │   └── types/                # 聊天类型定义
│   │       └── chat.types.ts
│   │
│   ├── files/                    # 文件功能域
│   │   ├── components/
│   │   │   ├── FileBrowser/
│   │   │   ├── FileList/
│   │   │   ├── FileGrid/
│   │   │   ├── FileToolbar/
│   │   │   └── FileViewer/
│   │   ├── hooks/
│   │   └── stores/
│   │
│   ├── sidebar/                  # 侧边栏功能域
│   │   ├── components/
│   │   │   ├── SidebarPanel/
│   │   │   ├── WorkingDirectory/
│   │   │   ├── RecentWorkspaces/
│   │   │   ├── Sessions/
│   │   │   ├── Search/
│   │   │   └── Settings/
│   │   └── hooks/
│   │
│   └── system/                   # 系统级功能
│       ├── components/
│       │   ├── Terminal/
│       │   └── LlmLogPanel/
│       └── modals/
│           ├── SystemPromptModal/
│           ├── ModelSelectorModal/
│           ├── ThinkingLevelModal/
│           └── LlmLogModal/
│
├── shared/                       # 共享层
│   ├── components/               # 通用UI组件
│   │   ├── ui/                   # 基础UI（Button, Input等）
│   │   ├── feedback/             # 反馈组件（Toast, Alert等）
│   │   └── layout/               # 布局辅助（Container, Stack等）
│   ├── hooks/                    # 通用hooks
│   ├── utils/                    # 工具函数
│   └── styles/                   # 全局样式
│
├── pages/                        # 页面层（保持简单）
│   ├── ChatPage/
│   │   ├── index.tsx
│   │   └── ChatPage.module.css
│   ├── FilesPage/
│   ├── LoadingScreen/
│   └── ErrorScreen/
│
├── stores/                       # 全局状态（精简）
│   ├── index.ts                  # 统一导出
│   ├── sessionStore.ts           # 会话/用户设置
│   └── modalStore.ts             # 全局模态框状态
│
├── services/                     # 服务层
├── hooks/                        # 通用hooks（可合并到shared）
├── types/                        # 全局类型
└── lib/                          # 工具库
```

---

## 具体重构步骤

### Phase 1: 建立新目录结构
```bash
# 创建新目录
mkdir -p src/client/app/{layout,providers,navigation}
mkdir -p src/client/features/{chat,files,sidebar,system}/{components,hooks}
mkdir -p src/client/shared/{components/{ui,feedback,layout},hooks,utils}
mkdir -p src/client/pages/{ChatPage,FilesPage,LoadingScreen,ErrorScreen}
```

### Phase 2: 迁移通用UI组件
- `components/ui/` → `shared/components/ui/`
- 删除 `components/example/`
- 删除 `components/commands/`（如为空）
- 删除 `components/test/`（如无用）

### Phase 3: 按功能域重组组件

#### Chat 功能域
```
features/chat/components/
├── MessageList/
├── MessageItem/
├── InputArea/
└── ChatPanel/
```

#### Files 功能域
```
features/files/components/
├── FileBrowser/
├── FileList/
├── FileGrid/
├── FileToolbar/
├── FileViewer/
├── FileActionBar/
└── FileSidebar/
```

#### Sidebar 功能域
```
features/sidebar/components/
├── SidebarPanel/
├── WorkingDirectory/
├── RecentWorkspaces/
├── Sessions/
├── SearchSection/          # 重命名避免与全局Search冲突
└── SettingsSection/        # 重命名
```

#### System 功能域
```
features/system/components/
├── Terminal/
├── LlmLogPanel/
└── modals/
    ├── SystemPromptModal/
    ├── ModelSelectorModal/
    ├── ThinkingLevelModal/
    └── LlmLogModal/
```

### Phase 4: 重构 Layout 层

当前 AppLayout 职责过多，拆分为：

```typescript
// app/layout/AppLayout.tsx - 只负责布局框架
interface AppLayoutProps {
  header: React.ReactNode;
  sidebar: React.ReactNode;
  main: React.ReactNode;
  footer: React.ReactNode;
  bottomPanel?: React.ReactNode;
}

// app/layout/AppHeader.tsx - 应用头部
interface AppHeaderProps {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

// features/sidebar/components/SidebarPanel/index.tsx
// 包含侧边栏具体内容的组装

// features/chat/components/ChatContainer/index.tsx
// 包含聊天相关的滚动逻辑、消息列表、输入框
```

### Phase 5: 重构 Pages

页面组件应该非常简单：

```typescript
// pages/ChatPage/index.tsx
export function ChatPage() {
  return (
    <ChatContainer>
      <MessageList />
      <InputArea />
    </ChatContainer>
  );
}

// 复杂的布局逻辑移到 features/chat/components/ChatContainer
```

---

## 命名规范

### 目录命名
- **功能域**: camelCase (`chat/`, `fileManager/`)
- **组件目录**: PascalCase (`MessageItem/`, `FileBrowser/`)
- **工具目录**: camelCase (`hooks/`, `utils/`, `types/`)

### 文件命名
- **组件**: PascalCase (`MessageItem.tsx`)
- **样式**: PascalCase.module.css (`MessageItem.module.css`)
- **Hooks**: camelCase with use prefix (`useChat.ts`)
- **工具**: camelCase (`formatDate.ts`)
- **常量**: camelCase或UPPER_SNAKE_CASE (`constants.ts`)

### 导出规范
```typescript
// 每个组件目录的 index.ts
export { Component } from './Component';
export type { ComponentProps } from './Component';

// 功能域的 index.ts
export * from './components';
export * from './hooks';
export * from './types';
```

---

## 依赖关系规范

```
pages/ -> features/ -> shared/ -> lib/
   ↓
stores/ -> services/
```

- **pages/**: 只导入 features/ 和 shared/
- **features/**: 可导入 shared/，但不可互相导入
- **shared/**: 只导入 lib/，不可导入 features/
- **stores/**: 可导入 services/，但不可导入 components

---

## 实施优先级

### P0 (立即)
1. 删除无用目录（example/, commands/, test/）
2. 创建新的目录结构
3. 迁移 ui/ 组件到 shared/

### P1 (本周)
1. 按功能域重组 chat/ 和 files/
2. 拆分 AppLayout 职责
3. 重构 TopBar（拆分 DirectoryPicker 为独立组件）

### P2 (下周)
1. 迁移 sidebar/ 到 features/
2. 重构 pages/ 简化
3. 统一导出方式

### P3 (后续)
1. 完善类型定义迁移
2. 更新测试文件位置
3. 文档更新
