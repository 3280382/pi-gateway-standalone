# Session 概念梳理与命名规范

## 核心概念

### 1. Session File（会话文件）
- **定义**: 物理存储的 `.jsonl` 文件，包含完整的消息历史
- **示例**: `/root/.pi/agent/sessions/2026-04-16T02-39-37-214Z_019d9428-86fd-7028-bf37-843874865337.jsonl`
- **用途**: 持久化存储所有消息

### 2. Short ID（短ID）
- **定义**: 从 session file 文件名提取的8字符唯一标识
- **示例**: `019d9428`（取UUID前8位）
- **用途**: 
  - 前端显示
  - 作为 Map 的 key
  - URL 参数
- **提取函数**: `extractShortSessionId(sessionFile)`

### 3. PiAgentSession（运行时会话）
- **定义**: 内存中的活跃会话实例，封装了 AgentSession
- **生命周期**: 从客户端连接到断开期间存在
- **状态**: idle, thinking, tooling, streaming, waiting, error
- **用途**: 处理消息发送、接收、流式输出

### 4. Client Selected Session（客户端选中会话）
- **定义**: 前端当前正在查看/交互的会话
- **用途**: 严格消息路由 - 只有选中的会话消息才会发送给客户端
- **存储**: `clientToSelectedSessionId: Map<WebSocket, shortId>`

## 命名规范

### 后端命名
| 概念 | 变量名 | 说明 |
|------|--------|------|
| 短ID | `shortId` | 8字符ID，如 `019d9428` |
| 完整文件路径 | `sessionFile` | 如 `/path/to/xxx.jsonl` |
| 运行时实例 | `session` 或 `piAgentSession` | PiAgentSession 实例 |
| 会话条目 | `sessionEntry` | SessionEntry 类型 |

### 前端命名
| 概念 | 变量名 | 说明 |
|------|--------|------|
| 短ID | `id` (Session.id) 或 `shortId` | 8字符ID |
| 完整路径 | `path` 或 `sessionFile` | 完整文件路径 |
| 选中ID | `selectedSessionId` | 当前选中的短ID |

## 需要重构的问题

### 问题1: 命名歧义
- `sessionId` 有时指短ID，有时指完整路径
- `id` 在 Session 接口中指短ID，但容易混淆

### 问题2: 消息加载
- 初始化只加载100条
- 需要支持滚动加载更多
- 切换session后需要重新加载历史消息

### 问题3: 消息路由
- 需要严格区分：客户端选中的session vs 后台运行的piAgentSession
