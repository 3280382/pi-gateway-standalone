# 精确修改指南

## 文件：`src/server/features/chat/agent-session/session-manager.ts`

### 第1部分：修改变量声明

**行号50-52**：
```typescript
// 修改前：
private workingDirToKey: Map<string, string> = new Map();
/** Maps WebSocket to workingDir for quick lookup on disconnect */
private clientToWorkingDir: Map<WebSocket, string> = new Map();

// 修改后：
private workingDirToKeys: Map<string, Set<string>> = new Map();
/** Maps WebSocket to sessionKey for quick lookup on disconnect */
private clientToSessionKey: Map<WebSocket, string> = new Map();
```

### 第2部分：修改 `getOrCreateSession` 方法

**行号105-112**（注释掉销毁逻辑）：
```typescript
// 修改前：
// Check if there's an existing session for this workingDir with different sessionFile
const existingKeyForDir = this.workingDirToKey.get(workingDir);
if (existingKeyForDir && existingKeyForDir !== sessionKey) {
  // Different session file for same workingDir - dispose old session
  console.log(
    `[ServerSessionManager] Different sessionFile for same workingDir, disposing old session: ${workingDir}`
  );
  this.disposeSessionByKey(existingKeyForDir);
}

// 修改后：
// 允许同一workingDir多个session共存，注释掉销毁逻辑
// const existingKeyForDir = this.workingDirToKey.get(workingDir);
// if (existingKeyForDir && existingKeyForDir !== sessionKey) {
//   console.log(...);
//   this.disposeSessionByKey(existingKeyForDir);
// }
```

**行号139**（更新客户端映射）：
```typescript
// 修改前：
this.clientToWorkingDir.delete(existingClient);

// 修改后：
this.clientToSessionKey.delete(existingClient);
```

**行号144**（更新客户端映射）：
```typescript
// 修改前：
this.clientToWorkingDir.set(client, workingDir);

// 修改后：
this.clientToSessionKey.set(client, sessionKey);
```

**行号184-186**（更新workingDir映射）：
```typescript
// 修改前：
// Update lookup maps
this.workingDirToKey.set(workingDir, newSessionKey);

// Update reverse mapping
this.clientToWorkingDir.set(client, workingDir);

// 修改后：
// Update lookup maps
if (!this.workingDirToKeys.has(workingDir)) {
  this.workingDirToKeys.set(workingDir, new Set());
}
this.workingDirToKeys.get(workingDir)!.add(newSessionKey);

// Update reverse mapping
this.clientToSessionKey.set(client, newSessionKey);
```

### 第3部分：修改 `switchSession` 方法

**行号238**：
```typescript
// 修改前：
const currentKey = this.workingDirToKey.get(currentWorkingDir);

// 修改后：
// 需要从 clientToSessionKey 获取当前客户端的sessionKey
const currentKey = this.clientToSessionKey.get(client);
// 注意：这里逻辑需要调整，因为现在客户端可能连接到任何session
// 简化方案：如果currentKey存在且对应的workingDir匹配，则处理
```

实际上，`switchSession`方法用于切换工作目录。我们需要重新设计这个方法，但现在为了简单，我们可以暂时保持原逻辑，但需要调整映射查找。

**行号238-247**（建议修改）：
```typescript
// 修改整个逻辑：
// Get current session key from client mapping
const currentKey = this.clientToSessionKey.get(client);
if (currentKey) {
  const currentEntry = this.sessions.get(currentKey);
  if (currentEntry && currentEntry.client === client) {
    console.log(`[ServerSessionManager] Ending old session for: ${currentKey}`);
    this.disposeSessionByKey(currentKey);
  }
}
```

### 第4部分：修改 `disconnectClient` 方法

**行号261**：
```typescript
// 修改前：
const sessionKey = this.workingDirToKey.get(workingDir);

// 修改后：
// 由于我们不知道具体是哪个sessionKey，需要遍历workingDirToKeys
const sessionKeys = this.workingDirToKeys.get(workingDir);
if (!sessionKeys) return;

// 查找该客户端连接的sessionKey
let targetSessionKey: string | null = null;
for (const key of sessionKeys) {
  const entry = this.sessions.get(key);
  if (entry && entry.client === client) {
    targetSessionKey = key;
    break;
  }
}
if (!targetSessionKey) return;

const entry = this.sessions.get(targetSessionKey);
// 后续代码使用entry...
```

**行号283**：
```typescript
// 修改前：
this.clientToWorkingDir.delete(client);

// 修改后：
this.clientToSessionKey.delete(client);
```

### 第5部分：修改 `disposeSessionByKey` 方法

**行号304**：
```typescript
// 修改前：
// Remove reverse mapping
this.clientToWorkingDir.delete(entry.client);

// Remove workingDir lookup
this.workingDirToKey.delete(entry.workingDir);

// 修改后：
// Remove reverse mapping
this.clientToSessionKey.delete(entry.client);

// Remove workingDir lookup
const sessionKeys = this.workingDirToKeys.get(entry.workingDir);
if (sessionKeys) {
  sessionKeys.delete(sessionKey);
  if (sessionKeys.size === 0) {
    this.workingDirToKeys.delete(entry.workingDir);
  }
}
```

### 第6部分：修改 `disposeSession` 方法

**行号318**：
```typescript
// 修改前：
const sessionKey = this.workingDirToKey.get(workingDir);

// 修改后：
// 现在可能有多个sessionKey，需要决定销毁哪一个
// 简化方案：销毁第一个找到的sessionKey
const sessionKeys = this.workingDirToKeys.get(workingDir);
if (!sessionKeys || sessionKeys.size === 0) return;

const sessionKey = Array.from(sessionKeys)[0];
this.disposeSessionByKey(sessionKey);
```

### 第7部分：修改 `getSession` 方法

**行号331**：
```typescript
// 修改前：
const sessionKey = this.workingDirToKey.get(workingDir);

// 修改后：
// 现在有多个sessionKey，返回第一个
const sessionKeys = this.workingDirToKeys.get(workingDir);
if (!sessionKeys || sessionKeys.size === 0) return undefined;

const sessionKey = Array.from(sessionKeys)[0];
return this.sessions.get(sessionKey);
```

### 第8部分：修改 `getSessionByFile` 方法

这个方法不需要修改，它使用`getSessionKey`直接查找。

### 第9部分：修改 `hasSession` 方法

**行号357**：
```typescript
// 修改前：
const sessionKey = this.workingDirToKey.get(workingDir);

// 修改后：
const sessionKeys = this.workingDirToKeys.get(workingDir);
if (!sessionKeys || sessionKeys.size === 0) return false;

// 检查是否至少有一个活跃的session
for (const sessionKey of sessionKeys) {
  const entry = this.sessions.get(sessionKey);
  if (entry && entry.session.session) {
    return true;
  }
}
return false;
```

### 第10部分：修改 `registerNewSession` 方法

**行号411**：
```typescript
// 修改前：
// Remove any existing entry for this workingDir first
const existingKey = this.workingDirToKey.get(workingDir);
if (existingKey) {
  this.disposeSessionByKey(existingKey);
}

// 修改后：
// 不再销毁现有会话，允许共存
```

**行号426**：
```typescript
// 修改前：
// Update lookup maps
this.workingDirToKey.set(workingDir, sessionKey);

// Update reverse mapping
this.clientToWorkingDir.set(client, workingDir);

// 修改后：
// Update lookup maps
if (!this.workingDirToKeys.has(workingDir)) {
  this.workingDirToKeys.set(workingDir, new Set());
}
this.workingDirToKeys.get(workingDir)!.add(sessionKey);

// Update reverse mapping
this.clientToSessionKey.set(client, sessionKey);
```

### 第11部分：修改 `getWorkingDirForClient` 方法

**行号445-452**：
```typescript
// 修改前：
getWorkingDirForClient(client: WebSocket): string | undefined {
  return this.clientToWorkingDir.get(client);
}

// 修改后：
getWorkingDirForClient(client: WebSocket): string | undefined {
  const sessionKey = this.clientToSessionKey.get(client);
  if (!sessionKey) return undefined;
  
  const entry = this.sessions.get(sessionKey);
  return entry?.workingDir;
}
```

### 第12部分：添加 `getActiveSessions` 方法

在文件末尾添加（在最后一个方法后）：
```typescript
/**
 * 获取工作目录下所有活跃会话
 * 供HTTP API调用
 */
getActiveSessions(workingDir: string): Array<{
  sessionFile: string;
  isActive: boolean;
  lastActivity: Date;
}> {
  const sessionKeys = this.workingDirToKeys.get(workingDir);
  if (!sessionKeys) return [];
  
  const result = [];
  for (const sessionKey of sessionKeys) {
    const entry = this.sessions.get(sessionKey);
    if (entry) {
      result.push({
        sessionFile: entry.sessionFile,
        isActive: entry.client.readyState === WebSocket.OPEN,
        lastActivity: entry.lastActivity,
      });
    }
  }
  
  return result;
}
```

## 文件：`src/server/features/chat/ws-handlers/session-handlers.ts`

### 修改 `handleLoadSession` 方法

**替换整个 `handleLoadSession` 函数**：
```typescript
export async function handleLoadSession(
  ctx: WSContext,
  payload: { sessionPath: string }
): Promise<void> {
  const { sessionPath } = payload;

  try {
    // 1. 获取当前工作目录（从当前会话或上下文）
    const currentWorkingDir = ctx.session?.workingDir;
    if (!currentWorkingDir) {
      sendError(ctx, "No working directory available");
      return;
    }
    
    // 2. 获取或创建目标会话
    const session = await serverSessionManager.getOrCreateSession(
      currentWorkingDir,
      ctx.ws,
      sessionPath  // 明确指定要切换到的session文件
    );
    
    // 3. 更新上下文引用
    ctx.session = session;
    
    // 4. 加载目标会话的消息历史
    const messages = await getSessionMessages(sessionPath);
    
    // 5. 获取所有会话列表（带状态）
    const allSessions = await getAllSessions(currentWorkingDir);
    
    // 6. 发送响应
    sendSuccess(ctx, "session_loaded", {
      success: true,
      sessionId: sessionPath,
      sessionFile: sessionPath,
      messages,
      allSessions,
    });
    
    logger.info(`[handleLoadSession] Session switched to: ${sessionPath}`);
  } catch (error) {
    logger.error("[handleLoadSession] Error:", {}, error instanceof Error ? error : undefined);
    sendSuccess(ctx, "session_loaded", {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load session",
    });
  }
}
```

### 修改 `handleNewSession` 方法

**行号78**（注释掉销毁调用）：
```typescript
// 修改前：
serverSessionManager.endSession(workingDir);

// 修改后：
// serverSessionManager.endSession(workingDir); // 不再销毁现有会话
```

## 文件：`src/server/features/chat/controllers/session.controller.ts`

### 添加 `getActiveSessions` 函数

在文件末尾添加：
```typescript
import { serverSessionManager } from "../agent-session/session-manager";

/**
 * 获取活跃会话列表
 */
export async function getActiveSessions(req: Request, res: Response) {
  const workingDir = req.query.workingDir as string;
  
  if (!workingDir) {
    return res.status(400).json({ 
      error: "workingDir parameter is required" 
    });
  }
  
  try {
    const activeSessions = serverSessionManager.getActiveSessions(workingDir);
    
    res.json({
      workingDir,
      activeSessions,
      count: activeSessions.length,
    });
  } catch (error) {
    logger.error(`[getActiveSessions] Error: ${error}`);
    res.status(500).json({ 
      error: "Failed to get active sessions" 
    });
  }
}
```

## 文件：`src/server/features/chat/http-routes.ts`

### 添加路由注册

在适当位置添加（约第44行，在 `app.get("/api/sessions", getSessions);` 附近）：
```typescript
app.get("/api/sessions/active", getActiveSessions);
```

## 文件：`src/client/features/chat/components/sidebar/SessionDropdownSection.tsx`

### 添加活跃状态显示

**修改渲染部分**：
```typescript
// 添加状态
const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());

// 定期获取活跃会话
useEffect(() => {
  const fetchActiveSessions = async () => {
    const workingDir = useSessionStore.getState().workingDir;
    if (!workingDir) return;
    
    try {
      const response = await fetch(
        `/api/sessions/active?workingDir=${encodeURIComponent(workingDir)}`
      );
      if (response.ok) {
        const data = await response.json();
        const activeFiles = new Set(
          data.activeSessions
            .filter((s: any) => s.isActive)
            .map((s: any) => s.sessionFile)
        );
        setActiveSessions(activeFiles);
      }
    } catch (error) {
      console.error("Failed to fetch active sessions:", error);
    }
  };
  
  fetchActiveSessions();
  const interval = setInterval(fetchActiveSessions, 5000);
  return () => clearInterval(interval);
}, []);

// 修改渲染逻辑
{sessions.map((session) => {
  const isActive = activeSessions.has(session.id);
  
  return (
    <div
      key={session.id}
      className={`${styles.dropdownItem} ${session.id === currentSessionId ? styles.active : ''}`}
      onClick={() => handleSelect(session)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span>
          {session.name || `Session ${session.id.slice(-8)}`}
          {isActive && (
            <span style={{ color: '#4CAF50', fontSize: '12px', marginLeft: '4px' }}>
              ●
            </span>
          )}
        </span>
        {session.messageCount > 0 && (
          <span className={styles.sessionCount}>{session.messageCount}</span>
        )}
      </div>
    </div>
  );
})}
```

## 测试验证步骤

### 1. 编译检查
```bash
npm run check
```

### 2. 启动服务
```bash
bash scripts/start-tmux-dev.sh
```

### 3. 测试API
```bash
curl "http://localhost:3000/api/sessions/active?workingDir=/root"
```

### 4. 浏览器测试
1. 打开 `http://localhost:3000`
2. 创建会话A，发送消息
3. 点击"New Session"创建会话B
4. 发送不同消息
5. 切换回会话A，验证历史
6. 观察侧边栏是否有绿点指示

## 常见问题解决

### Q1: 切换会话后消息不显示
- 检查 `handleLoadSession` 是否正确加载消息历史
- 检查WebSocket事件是否正确路由到新的会话

### Q2: 活跃状态不更新
- 检查 `/api/sessions/active` API是否返回正确数据
- 检查前端轮询间隔是否合适

### Q3: 内存泄漏
- 观察控制台日志，检查会话是否被正确清理
- 可后续添加会话超时清理机制

## 回滚方案

如果遇到问题，可回退修改：
```bash
# 恢复主要文件
git checkout src/server/features/chat/agent-session/session-manager.ts
git checkout src/server/features/chat/ws-handlers/session-handlers.ts
git checkout src/server/features/chat/controllers/session.controller.ts
git checkout src/server/features/chat/http-routes.ts
git checkout src/client/features/chat/components/sidebar/SessionDropdownSection.tsx
```

## 性能考虑

1. **HTTP轮询**：5秒间隔，影响极小
2. **内存使用**：多个会话共存可能增加内存，但每个会话约10-50MB
3. **WebSocket连接**：每个客户端一个连接，切换时重新关联

## 总结

此方案通过最小修改（约100行代码）实现了：
1. 同一工作目录多会话共存
2. 会话切换功能
3. 活跃状态显示
4. 向后兼容现有功能

修改重点在 `session-manager.ts` 的映射关系调整，其他文件为辅助性修改。