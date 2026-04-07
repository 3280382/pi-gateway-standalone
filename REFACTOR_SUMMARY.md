# 架构重构 - 变更摘要

## 📋 概述

### 服务端重构 (已完成)
将原有的 **技术分层架构**（controllers/routes/services）重构为 **Feature-Based 架构**（features/chat, features/session）。

### 客户端重构 (2025-04-06 完成)
将 Chat Feature 的 **UI 组件** 重构为 **Hook-Based 架构**，分离业务逻辑与 UI 渲染。

---

## 📁 Client 重构详情

### 目录结构变化

```
src/client/features/chat/
├── components/              # UI 组件（纯渲染，无业务逻辑）
│   ├── ChatPanel.tsx       # 现在：~65 行（原 ~150 行）
│   ├── InputArea.tsx       # 现在：~280 行（原 ~550 行）
│   ├── MessageList.tsx     # 保持不变
│   ├── MessageItem.tsx     # 保持不变
│   └── Header/
│       ├── AppHeader.tsx   # 类型错误修复，准备接入 hooks
│       └── DirectoryPicker.tsx  # 新提取的组件
│
├── hooks/                  # 业务逻辑 Hooks
│   ├── useChat.ts                 # 基础聊天操作
│   ├── useChatInit.ts             # 初始化逻辑
│   ├── useChatMessages.ts         # 消息过滤
│   ├── useChatPanel.ts            # [NEW] ChatPanel 业务逻辑
│   ├── useInputArea.ts            # [NEW] InputArea 主逻辑
│   ├── useFilePicker.ts           # [NEW] @mention 文件选择
│   ├── useImageUpload.ts          # [NEW] 图片上传 & OCR
│   ├── useSlashCommands.ts        # [NEW] / 命令选择
│   ├── useDirectoryPicker.ts      # [NEW] 目录浏览器
│   ├── useModelSelector.ts        # [NEW] 模型选择
│   ├── useThinkingSelector.ts     # [NEW] Thinking 级别
│   └── useSearchFilters.ts        # [NEW] 搜索过滤
│
├── stores/                 # 状态管理
├── services/               # API 服务
└── types/                  # 类型定义
```

### 新增 Hooks

| Hook | 职责 | 对应组件 | 代码行数 |
|------|------|----------|----------|
| `useChatPanel` | 消息滚动、发送协调 | ChatPanel | ~90 |
| `useInputArea` | 输入处理、发送逻辑 | InputArea | ~200 |
| `useFilePicker` | @mention 文件选择 | InputArea | ~140 |
| `useImageUpload` | 图片上传、OCR | InputArea | ~120 |
| `useSlashCommands` | Slash 命令选择 | InputArea | ~110 |
| `useDirectoryPicker` | 目录浏览器 | AppHeader | ~100 |
| `useModelSelector` | 模型选择 | AppHeader | ~90 |
| `useThinkingSelector` | Thinking 级别选择 | AppHeader | ~70 |
| `useSearchFilters` | 搜索过滤 | AppHeader | ~130 |

### 代码行数变化

| 组件/Hook | 重构前 | 重构后 | 变化 |
|-----------|--------|--------|------|
| InputArea.tsx | ~550 | ~280 | -49% |
| ChatPanel.tsx | ~150 | ~65 | -57% |
| AppHeader.tsx | ~650 | ~630 | -3% (仅修复) |
| 新增 Hooks | 0 | ~960 | +960 |
| **总计** | ~1350 | ~1935 | +43% (可维护性提升) |

### 架构原则

```
重构前：
Component (UI + Logic + State) → Store → Service

重构后：
Component (UI only) → Hook (Logic) → Store → Service
              │
              └→ Sub-Hooks (FilePicker, ImageUpload, etc.)
```

### 使用示例

```typescript
// 重构前：InputArea.tsx 内部包含所有逻辑
function InputArea(props) {
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [fileList, setFileList] = useState([]);
  // ... 200+ 行逻辑
}

// 重构后：逻辑委托给 Hook
function InputArea(props) {
  const inputArea = useInputArea(props);
  // 只负责 UI 渲染
}
```

---

## 📁 Server 重构详情

---

## 📁 最终目录结构

```
src/server/
├── app/
│   ├── registerRoutes.ts      # HTTP 路由注册
│   └── registerWS.ts          # WebSocket 处理器注册入口
│
├── config/
│   └── index.ts               # 配置
│
├── controllers/               # HTTP 控制器（待逐步迁移到 features/*/http/）
│   ├── file.controller.ts
│   ├── llm-log.controller.ts
│   ├── model.controller.ts
│   ├── ocr.controller.ts
│   ├── session.controller.ts
│   └── version.controller.ts
│
├── core/
│   └── session/
│       ├── GatewaySession.ts  # 核心会话类
│       ├── index.ts           # 模块导出
│       └── utils.ts           # 会话工具函数
│
├── features/
│   ├── chat/
│   │   └── ws/                # Chat WebSocket 处理器
│   │       ├── abort.ts
│   │       ├── command.ts
│   │       ├── index.ts
│   │       ├── list-models.ts
│   │       ├── prompt.ts
│   │       ├── set-llm-log.ts
│   │       ├── set-model.ts
│   │       ├── steer.ts
│   │       ├── thinking-level.ts
│   │       └── tool-request.ts
│   │
│   ├── session/
│   │   └── ws/                # Session WebSocket 处理器
│   │       ├── change-dir.ts
│   │       ├── index.ts
│   │       ├── init.ts
│   │       ├── list-sessions.ts
│   │       ├── load-session.ts
│   │       └── new-session.ts
│   │
│   └── files/                 # Files Feature（待扩展 HTTP 控制器）
│
├── lib/
│   ├── constants/
│   ├── errors/
│   ├── utils/
│   └── app-factory.ts
│
├── llm/                       # LLM 日志和拦截器
│
├── session/                   # ⚠️ 兼容性目录（已废弃）
│   ├── gateway-session.ts     # 重新导出
│   └── utils.ts               # 重新导出
│
├── shared/
│   └── websocket/
│       ├── types.ts           # WebSocket 类型定义
│       └── ws-router.ts       # WebSocket 路由器核心
│
├── index.ts                   # 统一导出入口
└── server.ts                  # 大幅简化
```

---

## 🔑 关键变更

### 1. WebSocket Router（核心改进）

**新增文件**: `src/server/shared/websocket/ws-router.ts`

```typescript
// 之前：server.ts 中的巨型 switch/case
switch (message.type) {
  case "prompt": await gatewaySession.prompt(...); break;
  case "abort": await gatewaySession.abort(); break;
  // ... 20+ 个 case
}

// 之后：使用 Router 分发
await wsRouter.dispatch(type, ctx, payload);
```

**特性**:
- 类似 Express 的路由风格
- 支持中间件链
- 统一错误处理
- 可插拔架构

### 2. Feature 处理器

**之前**: 所有逻辑集中在 `server.ts` (~400+ 行 switch/case)

**之后**: 每个消息类型一个文件

```typescript
// features/chat/ws/prompt.ts
export async function handlePrompt(ctx: WSContext, payload: PromptPayload) {
  // 只处理 prompt 逻辑
}
```

### 3. 简化的 server.ts

**之前**: ~400 行 WebSocket 消息处理逻辑

**之后**: ~100 行核心逻辑

```typescript
ws.on("message", async (data) => {
  const { type, payload } = parseMessage(data);
  await wsRouter.dispatch(type, ctx, payload);
});
```

### 4. GatewaySession 移动到 Core

**之前**: `src/server/session/gateway-session.ts`

**之后**: `src/server/core/session/GatewaySession.ts`

- 旧位置保持兼容性导出
- 新代码应从 core/session 导入

---

## 🗑️ 已删除的文件/目录

| 文件/目录 | 原因 |
|-----------|------|
| `src/server/routes/index.ts` | 被 `app/registerRoutes.ts` 替代 |
| `src/server/middleware/` | 空目录 |
| `src/server/services/` | 空目录 |
| `src/server/types/` | 空目录 |
| `src/server/shared/errors/` | 空目录 |
| `src/server/shared/utils/` | 空目录 |
| `src/server/features/*/http/` | 暂时未使用 |

---

## 📊 代码统计

| 指标 | 重构前 | 重构后 | 变化 |
|------|--------|--------|------|
| server.ts 行数 | ~400 | ~280 | -30% |
| WebSocket 处理器 | 1 个文件 | 15 个文件 | 可扩展 |
| 每个处理器职责 | N/A | 单一 | ✅ |
| 空目录 | 6+ | 0 | ✅ |
| 类型检查错误 | - | 0 | ✅ |

---

## 🔄 向后兼容

### 保持兼容的旧文件

```typescript
// session/gateway-session.ts
export { GatewaySession } from "../core/session/GatewaySession";

// session/utils.ts
export { AGENT_DIR, ... } from "../core/session/utils";
```

### 协议兼容性

- ✅ 所有 WebSocket 消息类型不变
- ✅ HTTP API 路径不变
- ✅ 响应格式不变

---

## ⚠️ Client 端影响

**无需任何修改** - 重构仅涉及服务端内部架构，所有协议和 API 保持不变。

Client 端使用的消息类型与处理器对照：

| Client 消息类型 | 服务端处理器 | 状态 |
|----------------|-------------|------|
| `prompt` | `features/chat/ws/prompt.ts` | ✅ |
| `abort` | `features/chat/ws/abort.ts` | ✅ |
| `thinking_level_change` | `features/chat/ws/thinking-level.ts` | ✅ |
| `load_session` | `features/session/ws/load-session.ts` | ✅ |
| `new_session` | `features/session/ws/new-session.ts` | ✅ |
| `change_dir` | `features/session/ws/change-dir.ts` | ✅ |
| `init` | `features/session/ws/init.ts` | ✅ |

---

## 🚀 扩展指南

### 添加新的 WebSocket 处理器

```typescript
// 1. 在对应 feature 目录创建处理器
// features/my-feature/ws/my-handler.ts
export async function handleMyMessage(ctx: WSContext, payload: MyPayload) {
  // 处理逻辑
}

// 2. 在 index.ts 注册
// features/my-feature/ws/index.ts
import { wsRouter } from "../../../shared/websocket/ws-router";
import { handleMyMessage } from "./my-handler";

export function registerMyFeatureWSHandlers() {
  wsRouter.register("my_message", handleMyMessage);
}
```

### 添加新的 Feature

```typescript
// 1. 创建目录结构
// features/new-feature/ws/
// features/new-feature/http/

// 2. 创建处理器并注册
// features/new-feature/ws/index.ts
wsRouter.register("new_message", handler);

// 3. 在 registerWS.ts 导入
import "./features/new-feature/ws/index";
```

---

## 📦 依赖关系

```
server.ts
  ├── app/registerRoutes.ts (HTTP 路由)
  ├── app/registerWS.ts (WebSocket 处理器)
  │     ├── features/session/ws/ (init, change_dir, etc.)
  │     └── features/chat/ws/ (prompt, abort, etc.)
  ├── core/session/GatewaySession.ts
  └── shared/websocket/ws-router.ts
```

---

## ✅ 验证检查清单

- [x] 类型检查通过（服务器端）
- [x] WebSocket Router 正确分发消息
- [x] 所有处理器正确注册
- [x] 向后兼容保持
- [x] GatewaySession 正确导出
- [x] 旧文件重导出兼容层
- [x] 空目录已清理
- [x] 冗余文件已删除
- [x] Client 端无需修改
