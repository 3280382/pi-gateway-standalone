# AI聊天后台API功能清单

## 已实现的后端API

### 1. WebSocket消息处理 (server.ts)

| 消息类型 | 状态 | 说明 |
|---------|------|------|
| `init` | ✅ | 初始化session，返回完整session信息 |
| `prompt` | ✅ | 发送消息给AI |
| `steer` | ✅ | 引导/修正AI回复 |
| `abort` | ✅ | 中止生成 |
| `new_session` | ✅ | 创建新session |
| `list_sessions` | ✅ | 列出工作目录的所有session |
| `load_session` | ✅ | 加载指定session |
| `set_model` | ✅ | 设置模型 |
| `list_models` | ✅ | 列出所有可用模型 |
| `change_dir` | ✅ | 切换工作目录 |
| `model_change` | ✅ | 切换模型 |
| `thinking_level_change` | ✅ | 切换思考级别 |

### 2. init响应数据 (gateway-session.ts)

| 字段 | 类型 | 说明 |
|-----|------|------|
| `sessionId` | string | 当前session ID |
| `sessionFile` | string | session文件路径 |
| `workingDir` | string | 当前工作目录 |
| `model` | string | 当前模型ID |
| `modelProvider` | string | 模型提供商 |
| `thinkingLevel` | string | 思考级别 |
| `systemPrompt` | string | 系统提示词内容 |
| `agentsFiles` | array | AGENTS.md文件列表 |
| `skills` | array | 可用技能列表 |
| `pid` | number | 服务器进程ID |

### 3. 响应消息类型

| 消息类型 | 状态 | 说明 |
|---------|------|------|
| `initialized` | ✅ | init完成响应 |
| `dir_changed` | ✅ | 目录切换完成 |
| `session_loaded` | ✅ | session加载完成 |
| `sessions_list` | ✅ | session列表 |
| `session_created` | ✅ | 新session创建完成 |

## 前端适配状态

### 已完成
- WebSocket连接建立
- `init`消息发送和响应处理
- 基础session信息显示

### 需要完善
1. **初始化流程优化**
   - 确保所有session信息正确保存到store
   - 在TopBar显示当前模型、思考级别、PID

2. **Session切换功能**
   - 加载session文件内容到聊天窗口
   - 重建历史消息

3. **工作目录切换**
   - 切换后自动获取新目录的session列表
   - 重新初始化聊天窗口

4. **消息内容获取**
   - 从session文件读取所有消息
   - 在MessageList中显示

## API调用示例

### 初始化Session
```javascript
// 发送
websocketService.send("init", {
  workingDir: "/root/project",
  sessionId: "optional-existing-session-id"
});

// 接收
{
  type: "initialized",
  sessionId: "xxx",
  sessionFile: "/path/to/session.jsonl",
  workingDir: "/root/project",
  model: "claude-3-5-sonnet",
  thinkingLevel: "medium",
  systemPrompt: "...",
  agentsFiles: [...],
  skills: [...],
  pid: 12345
}
```

### 切换工作目录
```javascript
// 发送
websocketService.send("change_dir", { path: "/new/path" });

// 接收
{
  type: "dir_changed",
  cwd: "/new/path",
  sessionId: "xxx",
  sessionFile: "/path/to/new/session.jsonl",
  pid: 12345
}
```

### 获取Session列表
```javascript
// 发送
websocketService.send("list_sessions", { cwd: "/path" });

// 接收
{
  type: "sessions_list",
  sessions: [
    { id, path, firstMessage, messageCount, cwd, modified }
  ]
}
```

### 加载Session
```javascript
// 发送
websocketService.send("load_session", { sessionPath: "/path/to/session.jsonl" });

// 接收
{
  type: "session_loaded",
  success: true,
  sessionId: "xxx",
  sessionFile: "...",
  cwdChanged: true,
  newCwd: "...",
  pid: 12345
}
```
