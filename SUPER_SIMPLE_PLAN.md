# 超级简单修改方案

## 核心思想
不改变现有映射结构，只做最小必要修改：
1. **允许会话共存**：注释掉销毁其他会话的代码
2. **简化查找逻辑**：需要时遍历`sessions`映射查找，不依赖`workingDirToKey`
3. **添加状态查询**：新增`getActiveSessions`方法

## 只需修改3个文件，总计不到30行代码

### 第一步：修改 `session-manager.ts`（15行）

#### 1.1 注释掉销毁逻辑（5行）
```typescript
// 第105-112行，改为：
// 允许同一workingDir多个session共存，注释掉以下代码：
// const existingKeyForDir = this.workingDirToKey.get(workingDir);
// if (existingKeyForDir && existingKeyForDir !== sessionKey) {
//   console.log(...);
//   this.disposeSessionByKey(existingKeyForDir);
// }
```

#### 1.2 修改 `getSession` 方法（5行）
```typescript
// 第331-340行，改为：
getSession(workingDir: string): SessionEntry | undefined {
  // 遍历查找第一个匹配workingDir的会话
  for (const [sessionKey, entry] of this.sessions) {
    if (entry.workingDir === workingDir) {
      return entry;
    }
  }
  return undefined;
}
```

#### 1.3 添加 `getActiveSessions` 方法（5行）
```typescript
// 在文件末尾添加：
getActiveSessions(workingDir: string): Array<{
  sessionFile: string;
  isActive: boolean;
}> {
  const result = [];
  for (const [sessionKey, entry] of this.sessions) {
    if (entry.workingDir === workingDir) {
      result.push({
        sessionFile: entry.sessionFile,
        isActive: entry.client.readyState === WebSocket.OPEN,
      });
    }
  }
  return result;
}
```

### 第二步：修改 `session-handlers.ts`（2行）

#### 2.1 修改 `handleLoadSession`（使用现有逻辑）
**不需要修改**，现有的`load_session`机制已经可以工作。
只需要确保同一workingDir多个会话可以共存即可。

#### 2.2 修改 `handleNewSession`（2行）
```typescript
// 第78行，注释掉：
// serverSessionManager.endSession(workingDir);
```

### 第三步：添加HTTP API（10行）

#### 3.1 在 `session.controller.ts` 末尾添加
```typescript
import { serverSessionManager } from "../agent-session/session-manager";

export async function getActiveSessions(req: Request, res: Response) {
  const workingDir = req.query.workingDir as string;
  if (!workingDir) {
    return res.status(400).json({ error: "workingDir parameter is required" });
  }
  
  try {
    const activeSessions = serverSessionManager.getActiveSessions(workingDir);
    res.json({ workingDir, activeSessions });
  } catch (error) {
    res.status(500).json({ error: "Failed to get active sessions" });
  }
}
```

#### 3.2 在 `http-routes.ts` 添加路由（1行）
```typescript
app.get("/api/sessions/active", getActiveSessions);
```

## 工作原理

### 会话共存
- 不再销毁同一workingDir下的其他会话
- 每个sessionFile独立存在`sessions`映射中

### 会话切换
- 前端发送`load_session`消息
- 后端`getOrCreateSession`创建/获取目标会话
- WebSocket连接重新关联到新会话（`reconnect`方法）

### 状态显示
- 前端轮询`/api/sessions/active`
- 后端遍历`sessions`返回活跃状态
- 侧边栏显示绿点指示

## 测试验证

### 1. 启动服务
```bash
bash scripts/start-tmux-dev.sh
```

### 2. 测试流程
```
1. 打开浏览器访问 http://localhost:3000
2. 创建会话A，发送消息 "Hello A"
3. 点击"New Session"创建会话B，发送消息 "Hello B"
4. 在侧边栏切换回会话A，应看到"Hello A"
5. 观察侧边栏，当前活跃会话应有绿点
```

### 3. API测试
```bash
curl "http://localhost:3000/api/sessions/active?workingDir=/root"
# 预期：{"activeSessions":[{"sessionFile":"...","isActive":true},...]}
```

## 优势

1. **修改极少**：总计不到30行代码
2. **风险极低**：不改变核心映射结构
3. **向后兼容**：现有功能完全不受影响
4. **易于维护**：逻辑简单清晰

## 注意事项

1. **内存管理**：多个会话长期运行可能占用内存，后续可添加清理机制
2. **查找性能**：遍历`sessions`映射，但会话数量少，影响可忽略
3. **状态同步**：HTTP轮询有延迟，但5秒间隔可接受

## 前端显示（可选）

如果不需要显示活跃状态，可以跳过前端修改，只修改后端允许多会话共存即可。

## 紧急回滚

```bash
# 恢复修改
git checkout src/server/features/chat/agent-session/session-manager.ts
git checkout src/server/features/chat/ws-handlers/session-handlers.ts
git checkout src/server/features/chat/controllers/session.controller.ts
git checkout src/server/features/chat/http-routes.ts
```

---

## 总结

此方案通过最小修改实现了：
- ✅ 同一工作目录多会话共存
- ✅ 会话切换功能
- ✅ 活跃状态查询API
- ✅ 向后兼容

修改重点只有一处：**允许会话共存**，其他均为辅助功能。