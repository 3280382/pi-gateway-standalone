# 简单多会话修改方案

## 当前架构分析

### 现有会话管理
- `ServerSessionManager` 管理 `PiAgentSession` 实例
- 每个 `(workingDir, sessionFile)` 对应一个会话实例
- 但当前实现限制每个 `workingDir` 只能有一个活跃会话
1. `workingDirToKey` 映射：`workingDir → sessionKey`
2. `getOrCreateSession` 中，如果同一 `workingDir` 已有不同 `sessionFile` 的会话，会销毁旧会话

### 前端侧边栏
- `SessionDropdownSection` 显示当前工作目录下的所有会话文件
- 用户选择会话时，调用 `controller.selectSession(session.id)`，发送 `load_session` 消息
- 后端 `handleLoadSession` 调用 `ctx.session.loadSession(sessionPath)`

### 问题
1. 同一工作目录无法同时存在多个活跃会话
2. 会话切换时，后端会话管理器未更新客户端与会话文件的映射
3. 侧边栏无法显示哪些会话正在运行

## 简化修改目标
1. **允许同一工作目录存在多个会话文件**，每个文件可独立运行
2. **支持会话切换**，切换后聊天界面显示对应会话的历史消息
3. **保持现有前端界面**，仅增强侧边栏会话列表显示运行状态
4. **最小化后端修改**，尽量复用现有代码

## 具体修改步骤

### 第一步：修改 `session-manager.ts`（核心）

#### 1.1 移除会话销毁限制
**文件**: `src/server/features/chat/agent-session/session-manager.ts`
**修改**: 移除 `getOrCreateSession` 中销毁同一工作目录下其他会话的代码

```typescript
// 找到以下代码（约第67-77行）：
// Check if there's an existing session for this workingDir with different sessionFile
const existingKeyForDir = this.workingDirToKey.get(workingDir);
if (existingKeyForDir && existingKeyForDir !== sessionKey) {
  // Different session file for same workingDir - dispose old session
  console.log(
    `[ServerSessionManager] Different sessionFile for same workingDir, disposing old session: ${workingDir}`
  );
  this.disposeSessionByKey(existingKeyForDir);
}

// 将其注释掉或删除
```

#### 1.2 改进映射关系
**修改**: 将 `workingDirToKey` 改为 `workingDirToKeys`，支持一对多映射

```typescript
// 第29行左右，替换：
private workingDirToKey: Map<string, string> = new Map();

// 改为：
private workingDirToKeys: Map<string, Set<string>> = new Map();
```

#### 1.3 更新 `getOrCreateSession` 中的映射逻辑
**修改**: 在创建新会话时，更新 `workingDirToKeys`

```typescript
// 在创建新会话后（约第135行），添加：
// Update workingDirToKeys mapping
if (!this.workingDirToKeys.has(workingDir)) {
  this.workingDirToKeys.set(workingDir, new Set());
}
this.workingDirToKeys.get(workingDir)!.add(newSessionKey);
```

#### 1.4 添加 `switchToSession` 方法
**添加**: 在同一工作目录内切换会话的方法

```typescript
/**
 * Switch to a different session file within the same working directory
 * @param workingDir Working directory
 * @param targetSessionFile Target session file path
 * @param client WebSocket client
 * @returns PiAgentSession instance for the target session
 */
async switchToSession(
  workingDir: string,
  targetSessionFile: string,
  client: WebSocket
): Promise<PiAgentSession> {
  console.log(
    `[ServerSessionManager] Switching to session: ${workingDir} + ${targetSessionFile}`
  );
  
  // Get current session key for this client
  const currentSessionKey = this.clientToWorkingDir.get(client);
  
  // If already connected to target session, return it
  const targetSessionKey = this.getSessionKey(workingDir, targetSessionFile);
  if (currentSessionKey === targetSessionKey) {
    return this.sessions.get(targetSessionKey)!.session;
  }
  
  // Disconnect from current session (if any)
  if (currentSessionKey) {
    const currentEntry = this.sessions.get(currentSessionKey);
    if (currentEntry && currentEntry.client === client) {
      // Remove client mapping but keep session alive
      this.clientToWorkingDir.delete(client);
      // Optionally notify session that client disconnected
      currentEntry.session.unsubscribeFn?.();
      currentEntry.session.unsubscribeFn = null;
    }
  }
  
  // Get or create target session
  return this.getOrCreateSession(workingDir, client, targetSessionFile);
}
```

#### 1.5 添加 `getSessionsByWorkingDir` 方法
**添加**: 获取工作目录下所有会话信息

```typescript
/**
 * Get all sessions for a working directory
 * @param workingDir Working directory
 * @returns Array of session info with status
 */
getSessionsByWorkingDir(workingDir: string): Array<{
  sessionFile: string;
  hasClient: boolean;
  clientCount: number;
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
        hasClient: entry.client.readyState === WebSocket.OPEN,
        clientCount: 1, // currently one client per session
        lastActivity: entry.lastActivity,
      });
    }
  }
  
  return result;
}
```

#### 1.6 修改 `disconnectClient` 方法
**修改**: 不再自动销毁会话，允许重连

```typescript
// 在 disconnectClient 方法中，注释掉或移除任何 disposeSession 调用
// 保留会话在 sessions 映射中，只清理客户端相关映射
```

### 第二步：修改 `session-handlers.ts`

#### 2.1 修改 `handleInit` 以支持显式 sessionFile
**修改**: 确保 `init` 消息可以指定要连接的会话文件

```typescript
// 在 handleInit 函数中，修改 getOrCreateSession 调用：
const session = await serverSessionManager.getOrCreateSession(
  workingDir,
  ctx.ws,
  clientSessionFile  // 使用客户端提供的 sessionFile
);
```

#### 2.2 修改 `handleLoadSession` 以使用 switchToSession
**修改**: 使用新的 switchToSession 方法切换会话

```typescript
// 替换现有的 handleLoadSession 实现：
export async function handleLoadSession(
  ctx: WSContext,
  payload: { sessionPath: string }
): Promise<void> {
  const { sessionPath } = payload;
  
  try {
    // Get current working directory from session
    const workingDir = ctx.session?.workingDir;
    if (!workingDir) {
      throw new Error("No working directory available");
    }
    
    // Switch to target session using session manager
    const session = await serverSessionManager.switchToSession(
      workingDir,
      sessionPath,
      ctx.ws
    );
    
    ctx.session = session;
    
    // Load session messages
    const messages = await getSessionMessages(sessionPath);
    
    // Send session_loaded response with updated session list
    const allSessions = await getAllSessions(workingDir);
    const sessionStatus = serverSessionManager.getSessionsByWorkingDir(workingDir);
    
    sendSuccess(ctx, "session_loaded", {
      success: true,
      sessionId: sessionPath,
      sessionFile: sessionPath,
      messages,
      allSessions,
      sessionStatus,  // 新增：会话状态信息
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

#### 2.3 修改 `handleNewSession` 以创建独立会话
**修改**: 确保新会话不会影响现有会话

```typescript
// 在 handleNewSession 中，移除 endSession 调用：
// 注释掉或删除：
// serverSessionManager.endSession(workingDir);
```

#### 2.4 修改 `handleChangeDir` 以保持会话独立
**修改**: 切换工作目录时，只影响当前客户端

```typescript
// 在 handleChangeDir 中，确保 switchSession 不会销毁其他会话
// 当前实现应该已经可以工作
```

### 第三步：修改 `session-helpers.ts`

#### 3.1 添加会话状态辅助函数
**添加**: 获取会话状态信息的函数

```typescript
/**
 * Get enhanced session list with status information
 */
export async function getEnhancedSessions(
  workingDir: string,
  sessionManager: typeof serverSessionManager
): Promise<Array<{
  id: string;
  path: string;
  name: string;
  messageCount: number;
  lastModified: string;
  isActive: boolean;
  hasClient: boolean;
}>> {
  const basicSessions = await getAllSessions(workingDir);
  const activeSessions = sessionManager.getSessionsByWorkingDir(workingDir);
  
  return basicSessions.map(session => {
    const activeSession = activeSessions.find(s => s.sessionFile === session.path);
    return {
      ...session,
      isActive: !!activeSession,
      hasClient: activeSession?.hasClient || false,
    };
  });
}
```

#### 3.2 修改 `buildSessionResponse` 以包含状态信息
**修改**: 在响应中添加会话状态

```typescript
// 在 buildSessionResponse 函数中，修改 allSessions 获取：
const [basicSessions, allModels] = await Promise.all([
  getAllSessions(workingDir),
  getAllModels(),
]);

// 获取增强的会话列表（带状态）
const enhancedSessions = await getEnhancedSessions(workingDir, serverSessionManager);

return {
  pid: process.pid,
  workingDir,
  currentSession: {
    sessionId,
    sessionFile,
    messages: sessionMessages,
  },
  allSessions: enhancedSessions,  // 使用带状态的会话列表
  currentModel,
  defaultModel,
  allModels,
  thinkingLevel: session.session?.thinkingLevel || "off",
};
```

### 第四步：修改前端侧边栏

#### 4.1 修改 `SessionDropdownSection.tsx`
**修改**: 显示会话状态指示器

```typescript
// 在渲染会话列表时，添加状态指示器
{sessions.map((session) => (
  <div
    key={session.id}
    className={`${styles.dropdownItem} ${session.id === currentSessionId ? styles.active : ''}`}
    onClick={() => handleSelect(session)}
  >
    <div className={styles.sessionInfo}>
      <span className={styles.sessionName}>
        {session.name || `Session ${session.id.slice(-8)}`}
      </span>
      {/* 状态指示器 */}
      <span className={styles.sessionStatus}>
        {session.hasClient && (
          <span className={styles.statusIndicator} title="Active session">
            ●
          </span>
        )}
      </span>
    </div>
    {session.messageCount > 0 && (
      <span className={styles.sessionCount}>{session.messageCount}</span>
    )}
  </div>
))}
```

#### 4.2 更新样式
**添加**: 状态指示器样式

```css
/* 在 SidebarPanel.module.css 中添加 */
.sessionStatus {
  margin-left: auto;
  margin-right: 8px;
}

.statusIndicator {
  color: #4CAF50; /* 绿色表示活跃 */
  font-size: 12px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
```

#### 4.3 修改侧边栏控制器
**修改**: `sidebarApi.ts` 以处理新的会话状态信息

```typescript
// 在 handleWebSocketMessage 中，处理 session_loaded 事件时更新会话状态
case "session_loaded":
  if (data.success && data.sessionStatus) {
    // 更新会话状态
    useSidebarStore.getState().updateSessionStatus(data.sessionStatus);
  }
  break;
```

### 第五步：添加会话状态更新事件

#### 5.1 修改 `session-manager.ts` 以广播状态更新
**添加**: 当会话状态变化时，通知所有相关客户端

```typescript
/**
 * Broadcast session list update to all clients in a working directory
 */
private broadcastSessionUpdate(workingDir: string): void {
  const sessionKeys = this.workingDirToKeys.get(workingDir);
  if (!sessionKeys) return;
  
  const sessionStatus = this.getSessionsByWorkingDir(workingDir);
  
  // Send to all clients in this working directory
  for (const sessionKey of sessionKeys) {
    const entry = this.sessions.get(sessionKey);
    if (entry && entry.client.readyState === WebSocket.OPEN) {
      try {
        entry.client.send(JSON.stringify({
          type: "sessions_updated",
          data: {
            workingDir,
            sessions: sessionStatus,
            timestamp: new Date().toISOString(),
          },
        }));
      } catch (e) {
        // Ignore send errors
      }
    }
  }
}
```

#### 5.2 在关键操作后调用广播
**添加**: 在以下方法中调用 `broadcastSessionUpdate`:
- `getOrCreateSession` 创建新会话后
- `switchToSession` 切换会话后
- `disconnectClient` 客户端断开后

### 第六步：测试验证

#### 6.1 创建测试场景
1. **场景1**: 同一工作目录创建多个会话
   - 打开应用，创建新会话A
   - 在侧边栏点击"New Session"创建会话B
   - 验证两个会话同时存在，可独立切换

2. **场景2**: 会话切换保持状态
   - 在会话A中发送消息
   - 切换到会话B，发送不同消息
   - 切回会话A，验证消息历史正确恢复

3. **场景3**: 会话状态指示
   - 观察侧边栏会话列表，当前活跃会话应有状态指示
   - 切换会话，验证状态指示正确更新

4. **场景4**: 重连恢复
   - 刷新页面，验证所有会话状态恢复
   - 断开网络后重连，验证会话状态同步

#### 6.2 预期结果
- 同一工作目录可同时存在多个会话
- 侧边栏显示所有会话及运行状态
- 会话切换流畅，消息历史正确加载
- 后端正确管理会话生命周期

## 风险与缓解

### 技术风险
1. **会话映射混乱**
   - **风险**: 修改映射关系可能导致客户端无法找到正确会话
   - **缓解**: 仔细测试映射逻辑，添加详细日志

2. **资源泄漏**
   - **风险**: 多个会话实例可能消耗过多内存
   - **缓解**: 实现会话超时清理机制（后续添加）

3. **状态同步问题**
   - **风险**: 前端会话状态与后端不一致
   - **缓解**: 通过WebSocket事件实时同步状态

### 兼容性风险
1. **现有功能受影响**
   - **风险**: 修改可能破坏现有单会话功能
   - **缓解**: 保持向后兼容，新增功能默认关闭或可选

2. **数据迁移**
   - **风险**: 现有用户会话数据可能需要迁移
   - **缓解**: 保持数据格式不变，仅扩展功能

## 实施优先级

### 第一阶段（核心功能，1-2天）
1. 修改 `session-manager.ts` 移除会话销毁限制
2. 实现 `switchToSession` 方法
3. 修改 `handleLoadSession` 使用新方法
4. 测试基本会话切换功能

### 第二阶段（状态显示，1天）
1. 添加会话状态获取和广播功能
2. 修改前端侧边栏显示状态指示器
3. 测试状态同步功能

### 第三阶段（优化完善，1天）
1. 添加会话超时清理
2. 优化性能，减少不必要的状态广播
3. 完善错误处理和日志

## 回滚方案

如遇到严重问题，可回退到单会话模式：

1. **代码回滚**: 恢复修改的文件
2. **配置回滚**: 通过功能开关禁用多会话功能
3. **数据恢复**: 会话数据格式未变，无需特殊处理

## 后续扩展

### 短期扩展
1. **会话命名**: 允许用户为会话自定义名称
2. **会话收藏**: 标记常用会话
3. **批量操作**: 同时关闭多个会话

### 长期扩展
1. **会话模板**: 基于角色文件创建预配置会话
2. **会话分享**: 导出/导入会话配置和历史
3. **协作会话**: 多人同时连接同一会话

---

## 开始实施

建议按以下顺序实施修改：

1. **备份现有代码**
   ```bash
   cp src/server/features/chat/agent-session/session-manager.ts session-manager.backup.ts
   ```

2. **修改 `session-manager.ts`**（第一阶段核心修改）
3. **修改 `session-handlers.ts`** 中的 `handleLoadSession`
4. **测试基本功能**：创建多个会话并切换
5. **逐步实施其他修改**

每个修改步骤后都应运行测试，确保现有功能不受影响：

```bash
npm run check  # 代码检查
npm test       # 单元测试
# 手动测试会话切换功能
```

如遇问题，可参考本方案或回退到备份文件。