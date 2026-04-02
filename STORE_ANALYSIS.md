# Store 设计分析报告

## 当前 Store 列表

| Store | 用途 | 使用文件数 | 状态 |
|-------|------|-----------|------|
| chatStore.ts | 聊天消息、流式状态、工具状态 | 8+ | ✅ 活跃 |
| new-chat.store.ts | "精简版"聊天状态 | 4 | ⚠️ 重复 |
| sessionStore.ts | 会话、工作目录、用户设置 | 10+ | ✅ 活跃 |
| sidebarStore.ts | 侧边栏 UI、搜索过滤 | 8+ | ✅ 活跃 |
| sidebarExtrasStore.ts | 设置面板、LLM日志配置 | 1 | ⚠️ 冗余 |
| uiStore.ts | 主题、字体、模态框、Toast | 0 | ❌ 未使用 |
| modalStore.ts | 模态框开关状态 | 6 | ✅ 活跃 |
| searchStore.ts | 消息搜索 | 1 | ✅ 专用 |
| fileStore.ts | 文件浏览器状态 | 6 | ✅ 活跃 |
| fileViewerStore.ts | 文件查看器 | 6 | ✅ 活跃 |
| llmLogStore.ts | LLM日志配置 | 1 | ✅ 专用 |

## 主要问题

### 1. 重复定义 (Critical)

**chatStore vs new-chat.store.ts**
- 两者管理几乎相同的状态（messages, streaming, tools）
- new-chat.store.ts 最初设计为"精简版"，但实际没有精简多少
- 当前使用混乱：chatStore 主要使用，new-chat.store.ts 只在初始化/controller使用

**建议**: 合并为一个 chatStore，移除 new-chat.store.ts

### 2. 状态分散 (High)

**主题/字体设置分散在3个store中:**
- sessionStore: theme, fontSize (持久化)
- sidebarStore: theme, fontSize (持久化)
- uiStore: theme, fontSize (未使用)

**工作目录分散:**
- sessionStore: currentDir (持久化)
- sidebarStore: workingDir (非持久化，仅显示用)

**建议**: 
- 主题/字体只保留在 sessionStore（用户设置）
- sidebarStore 从 sessionStore 读取 workingDir

### 3. 未使用的 Store (High)

**uiStore.ts**
- 完全没有被任何组件引用
- 包含的功能被其他 store 覆盖：
  - 主题/字体 → sessionStore
  - 侧边栏状态 → sidebarStore 或 LayoutContext
  - 模态框 → modalStore
  - Toast → 可合并到 notificationStore

**建议**: 删除 uiStore.ts

### 4. 过度拆分 (Medium)

**sidebarExtrasStore.ts**
- 只在 Settings.tsx 中使用（3个调用）
- 内容可以合并到：
  - llmLogConfig → llmLogStore
  - openLlmLog → modalStore

**建议**: 删除 sidebarExtrasStore.ts，内容合并到对应 store

### 5. 命名不规范 (Medium)

| 当前命名 | 问题 | 建议 |
|---------|------|------|
| uiStore.ts | 太泛，不知道具体管什么 | 删除 |
| new-chat.store.ts | 临时命名，已成历史包袱 | 删除或重命名 |
| sidebarExtrasStore.ts | 不清楚"extras"指什么 | 删除 |

## 重构计划

### 阶段1: 删除未使用和冗余 store
1. 删除 `uiStore.ts`
2. 删除 `sidebarExtrasStore.ts`（内容迁移）
3. 合并 `new-chat.store.ts` 到 `chatStore.ts`

### 阶段2: 合并重复状态
1. 统一主题/字体管理到 `sessionStore`
2. 清理 `sidebarStore` 中的重复状态
3. 建立 store 间的依赖关系（sidebarStore 读取 sessionStore）

### 阶段3: 命名规范
1. 使用具体、描述性的命名
2. 按照功能域组织（chat-, file-, session-, notification-）

## 目标架构

```
stores/
├── chatStore.ts          # 聊天消息、流式状态
├── fileStore.ts          # 文件浏览器
├── fileViewerStore.ts    # 文件查看器
├── sessionStore.ts       # 用户设置、会话状态
├── sidebarStore.ts       # 侧边栏 UI（依赖 sessionStore）
├── modalStore.ts         # 模态框状态
├── searchStore.ts        # 消息搜索
├── llmLogStore.ts        # LLM 日志配置
└── index.ts
```

## 迁移影响评估

| 操作 | 影响文件数 | 风险 |
|------|-----------|------|
| 删除 uiStore.ts | 0 | 无风险 |
| 删除 sidebarExtrasStore.ts | 1 | 低 |
| 合并 new-chat.store.ts | 4 | 中 |
| 统一主题/字体 | 6+ | 中 |
