# Session 架构重构设计文档

## 目标

实现统一的 Session ID 系统，简化前后端状态管理，提升用户体验。

## 核心设计

### 1. 统一 ID 规范

**短 ID（Short ID）**：从 session file 路径提取的唯一标识

```
完整路径: /root/.pi/agent/sessions/--root-pi-gateway-standalone--/2026-04-17T08-26-10-585Z_019d9a8c-2b19-7345-94f5-5efedb498871.jsonl
短 ID:     5efedb498871

提取规则: 文件名最后 _ 后面的 UUID 部分
```

**所有组件使用短 ID 关联**：
- LocalStorage: `currentSessionId = "5efedb498871"`
- WebSocket messages: `{ sessionId: "5efedb498871" }`
- Server PiAgentSession: `this.shortId = "5efedb498871"`
- Session file: 从路径提取

### 2. 架构变更

#### 当前架构（问题）
```
Frontend                    Backend
   |                           |
   |--HTTP GET /api/sessions-->|
   |<--JSON--                  |
   |                           |
   |--WS init (full path)----->|
   |                           |
```

**问题**：
- ID 格式不统一（完整路径 vs 短 ID）
- HTTP 和 WebSocket 混用
- 比较逻辑复杂（需要处理多种格式）

#### 新架构（目标）
```
Frontend                    Backend
   |                           |
   |--WS list_sessions-------->|
   |<--[{id, name, status}]--- |
   |                           |
   |--WS init {sessionId}----->|
   |<--WS session_status------>|
   |                           |
```

**优势**：
- 统一短 ID
- 纯 WebSocket 通信
- 实时状态更新

### 3. 运行状态系统

**状态定义**：
```typescript
type SessionRuntimeStatus = 
  | "idle"        // 空闲，等待输入
  | "thinking"    // AI 正在思考
  | "tooling"     // 正在执行工具
  | "streaming"   // 正在流式输出
  | "waiting"     // 等待用户输入
  | "error";      // 发生错误
```

**状态流转**：
```
idle -> thinking -> tooling -> streaming -> idle
                    ↓
              waiting (需要用户确认/输入)
                    ↓
              idle
```

**状态广播**：
- 后端：每 5 秒广播一次所有活跃会话的状态
- 前端：实时更新侧边栏状态指示器

### 4. 接口变更

#### 移除 HTTP API
- ~~`GET /api/sessions`~~ → WebSocket `list_sessions`
- ~~`GET /api/sessions/active`~~ → WebSocket `sessions_status`
- ~~`GET /api/models`~~ → WebSocket `list_models`

#### 新增 WebSocket 消息
```typescript
// Client -> Server
interface ListSessionsMessage {
  type: "list_sessions";
  workingDir: string;
}

interface GetSessionStatusMessage {
  type: "get_session_status";
  sessionId: string; // 短 ID
}

// Server -> Client
interface SessionsListMessage {
  type: "sessions_list";
  sessions: {
    id: string;        // 短 ID
    name: string;
    messageCount: number;
    lastModified: string;
    status: SessionRuntimeStatus;
  }[];
}

interface SessionStatusMessage {
  type: "session_status";
  sessionId: string;
  status: SessionRuntimeStatus;
  statusText: string; // 人类可读的状态描述
  lastActivity: string;
}

interface RuntimeStatusBroadcast {
  type: "runtime_status_broadcast";
  sessions: {
    sessionId: string;
    status: SessionRuntimeStatus;
    statusText: string;
  }[];
}
```

### 5. UI 变更

#### 顶部显示当前会话 ID
```
┌─────────────────────────────────────────────────────────────┐
│  Pi Gateway                        [5efedb49]  [thinking]   │
│  /root/pi-gateway-standalone                                │
└─────────────────────────────────────────────────────────────┘
```

**组件**：在 AppHeader 中添加会话 ID 和状态徽章

#### 侧边栏状态指示器增强
```
┌─ Session ───────────────────────────┐
│                                     │
│  ● Session A              [thinking]│
│  ○ Session B                  [idle]│
│  ● Session C               [tooling]│  ← 实时状态
│                                     │
└─────────────────────────────────────┘
```

**状态图标**：
- 🟢 `idle` / `waiting` - 等待输入
- 🟡 `thinking` - 思考中
- 🔵 `tooling` - 执行工具
- 🟣 `streaming` - 流式输出
- 🔴 `error` - 错误

## 实施步骤

### Phase 1: 后端重构（约 2-3 小时）
1. 修改 session-manager.ts
   - 添加短 ID 生成和映射
   - 修改所有方法使用短 ID
   - 添加运行状态跟踪

2. 修改 piAgentSession.ts
   - 添加 shortId 属性
   - 实现状态检测逻辑
   - 添加状态变更事件

3. 修改 ws-handlers
   - 添加 list_sessions 处理器
   - 添加 sessions_status 处理器
   - 移除 HTTP 相关代码

4. 添加状态广播系统
   - 定时广播所有活跃会话状态
   - 状态变更时即时广播

### Phase 2: 前端重构（约 2-3 小时）
1. 修改 stores
   - 统一使用短 ID
   - 更新状态类型定义
   - 添加运行状态存储

2. 修改 API 层
   - 移除 HTTP 调用
   - 添加 WebSocket 消息处理
   - 更新服务接口

3. 修改 UI 组件
   - AppHeader 添加会话 ID 显示
   - SessionDropdownSection 增强状态显示
   - 添加状态图标和动画

### Phase 3: 测试验证（约 1 小时）
1. 验证 ID 一致性
2. 验证状态流转
3. 验证实时更新

## 代码规范

### ID 处理规范
```typescript
// ✅ 正确：使用短 ID
const sessionId = extractShortId(sessionFile); // "5efedb498871"

// ❌ 错误：使用完整路径
const sessionId = sessionFile; // "/root/.pi/agent/sessions/..."

// 提取函数
function extractShortId(sessionFile: string): string {
  const fileName = sessionFile.split("/").pop() || "";
  const parts = fileName.replace(".jsonl", "").split("_");
  return parts[parts.length - 1];
}
```

### 状态检测规范
```typescript
// 在 PiAgentSession 中
getRuntimeStatus(): SessionRuntimeStatus {
  if (this.isStreaming) return "streaming";
  if (this.isThinking) return "thinking";
  if (this.activeTool) return "tooling";
  if (this.waitingForInput) return "waiting";
  return "idle";
}
```

## 注意事项

1. **向后兼容**：重构期间保持旧接口可用，逐步迁移
2. **错误处理**：短 ID 提取失败时回退到完整路径
3. **性能**：状态广播频率控制在 5 秒，避免过度通信
4. **调试**：添加详细日志，便于排查 ID 不匹配问题
