# Chat Session 重构规划文档

## 完成情况总结

### ✅ 阶段一：客户端统一（已完成）

#### 1.1 localStorage sessionFile 持久化
- `persist.config.ts`: 添加 `currentSessionFile` 到持久化配置
- `sessionStore.ts`: 添加 `persist` 中间件

#### 1.2 统一 API 调用入口
- `useChat.ts`: 使用 `sendChatMessage` 和 `abortChatGeneration`
- `sessionManager.ts`: 使用 `initChatWorkingDirectory`
- 所有 WebSocket 发送统一通过 `chatWebSocket.ts`

#### 1.3 统一消息加载逻辑
- 新建 `messageUtils.ts` 包含 `normalizeSessionMessages`
- 所有路径都使用统一的消息转换函数

### ✅ 阶段二：服务端重构（已完成）

#### 2.1 Session 管理器精简
- 新建 `session-helpers.ts` 共享辅助函数:
  - `getAllSessions()` - 获取所有 session
  - `getAllModels()` - 获取所有模型
  - `getSessionMessages()` - 读取 session 消息
  - `buildSessionResponse()` - 构建统一响应

#### 2.2 WebSocket Handler 简化
- `init.ts`: 从 259 行简化到 123 行，使用共享函数
- `change-dir.ts`: 从 221 行简化到 79 行，使用共享函数
- 两个 handler 代码结构一致，易于维护

---

## 修改统计

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `persist.config.ts` | 修改 | 添加 `currentSessionFile` 持久化 |
| `sessionStore.ts` | 修改 | 添加 `persist` 中间件和 `currentSessionFile` |
| `useChat.ts` | 修改 | 使用统一的 chatWebSocket API |
| `sessionManager.ts` | 修改 | 使用 `initChatWorkingDirectory` |
| `chatWebSocket.ts` | 修改 | 更新 `initChatWorkingDirectory` 签名 |
| `messageUtils.ts` | 新增 | 统一消息转换函数 |
| `session-helpers.ts` | 新增 | 服务端共享辅助函数 |
| `init.ts` | 重写 | 简化代码，使用共享函数 (259→123 行) |
| `change-dir.ts` | 重写 | 简化代码，使用共享函数 (221→79 行) |

---

## 架构改进

### 客户端架构
```
useChatInit / sessionManager
    ↓
initChatWorkingDirectory (chatWebSocket.ts)
    ↓
websocketService.send
    ↓
normalizeSessionMessages (messageUtils.ts)
    ↓
chatStore.setMessages
```

### 服务端架构
```
handleInit / handleChangeDir
    ↓
serverSessionManager.getOrCreateSession / switchSession
    ↓
buildSessionResponse (session-helpers.ts)
    ↓
getAllSessions / getAllModels / getSessionMessages
    ↓
ctx.ws.send
```

---

## 验证清单

- [x] 类型检查通过 (`npx tsc --noEmit`)
- [ ] 左侧面板 session 加载正常
- [ ] 刷新页面后 session 恢复
- [ ] 切换 session 后消息正确显示
- [ ] 工具消息格式正确
- [ ] 连接→断开→重连→刷新 循环测试

---

## 下一步

运行测试验证所有功能正常：
1. 启动开发服务器
2. 测试左侧面板加载
3. 测试刷新页面恢复
4. 测试连接稳定性
