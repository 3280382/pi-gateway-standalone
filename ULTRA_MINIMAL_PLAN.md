# 极简多会话修改方案

## 需求澄清
1. **后台**：同一工作目录下可同时运行多个活跃AI进程（每个会话独立）
2. **前台**：左侧面板显示所有会话及其活跃状态（绿点指示）
3. **交互**：中间聊天界面只关联一个活跃进程，可随时切换
4. **通信**：当前关联的进程通过WebSocket通信，切换时前端发送`load_session`消息
5. **API**：通过HTTP API获取活跃会话列表

## 现状分析

### 当前限制
```typescript
// session-manager.ts 中的关键限制：
private workingDirToKey: Map<string, string> = new Map();  // 一对一映射

// 在 getOrCreateSession 中：
if (existingKeyForDir && existingKeyForDir !== sessionKey) {
  this.disposeSessionByKey(existingKeyForDir);  // 销毁同一workingDir下的其他会话
}
```

### 当前切换逻辑
```typescript
// handleLoadSession 中：
await ctx.session.loadSession(sessionPath);  // 使用现有的PiAgentSession加载另一个session文件
// 这不会创建新的AgentSession实例，只是加载历史
```

## 极简修改方案（3个文件）

### 第一步：修改 `session-manager.ts`（仅需修改20行）

#### 1.1 修改映射关系（2行）
```typescript
// 第50行，改为：
private workingDirToKeys: Map<string, Set<string>> = new Map();

// 第52行，改为：
private clientToSessionKey: Map<WebSocket, string> = new Map();
```

#### 1.2 修改 `getOrCreateSession`（5行）
```typescript
// 第105-112行，注释掉销毁逻辑：
// const existingKeyForDir = this.workingDirToKey.get(workingDir);
// if (existingKeyForDir && existingKeyForDir !== sessionKey) {
//   console.log(...);
//   this.disposeSessionByKey(existingKeyForDir);
// }

// 第184行，改为：
if (!this.workingDirToKeys.has(workingDir)) {
  this.workingDirToKeys.set(workingDir, new Set());
}
this.workingDirToKeys.get(workingDir)!.add(newSessionKey);
```

#### 1.3 修改 `clientToWorkingDir` 相关代码（6行）
搜索所有 `clientToWorkingDir`，替换为 `clientToSessionKey`：
- 第139行：`this.clientToWorkingDir.delete(existingClient);`
- 第144行：`this.clientToWorkingDir.set(client, workingDir);`
- 第191行：`this.clientToWorkingDir.set(client, workingDir);`
- 第258行：`this.clientToWorkingDir.delete(client);`
- 第308行：`this.clientToWorkingDir.delete(entry.client);`
- 第372行：`this.clientToWorkingDir.set(client, workingDir);`

#### 1.4 添加 `getActiveSessions` 方法（7行）
```typescript
/**
 * 获取活跃会话列表（供HTTP API调用）
 */
getActiveSessions(workingDir: string): Array<{
  sessionFile: string;
  isActive: boolean;
}> {
  const sessionKeys = this.workingDirToKeys.get(workingDir);
  if (!sessionKeys) return [];
  
  return Array.from(sessionKeys)
    .map(key => this.sessions.get(key))
    .filter(entry => entry)
    .map(entry => ({
      sessionFile: entry!.sessionFile,
      isActive: entry!.client.readyState === WebSocket.OPEN,
    }));
}
```

### 第二步：修改 `session-handlers.ts`（仅需修改2处）

#### 2.1 修改 `handleLoadSession`（关键修改）
```typescript
export async function handleLoadSession(
  ctx: WSContext,
  payload: { sessionPath: string }
): Promise<void> {
  const { sessionPath } = payload;
  
  try {
    // 获取当前workingDir
    const workingDir = ctx.session?.workingDir;
    if (!workingDir) {
      throw new Error("No working directory available");
    }
    
    // 获取或创建目标会话
    const session = await serverSessionManager.getOrCreateSession(
      workingDir,
      ctx.ws,
      sessionPath  // 明确指定要切换到的session文件
    );
    
    // 更新上下文中的session引用
    ctx.session = session;
    
    // 加载目标会话的消息历史
    const messages = await getSessionMessages(sessionPath);
    
    // 发送响应
    sendSuccess(ctx, "session_loaded", {
      success: true,
      sessionId: sessionPath,
      messages,
    });
    
    logger.info(`[handleLoadSession] Switched to session: ${sessionPath}`);
  } catch (error) {
    // 错误处理保持不变
  }
}
```

#### 2.2 修改 `handleNewSession`（可选）
```typescript
// 注释掉以下行（约第78行）：
// serverSessionManager.endSession(workingDir);
```

### 第三步：添加HTTP API端点（新增15行）

#### 3.1 修改 `session.controller.ts`
在文件末尾添加：
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
    logger.error("[getActiveSessions] Error:", error);
    res.status(500).json({ error: "Failed to get active sessions" });
  }
}
```

#### 3.2 修改 `http-routes.ts`
添加路由：
```typescript
app.get("/api/sessions/active", getActiveSessions);
```

### 第四步：修改前端侧边栏（可选，仅显示状态）

#### 4.1 修改 `SessionDropdownSection.tsx`
```typescript
// 添加状态获取
const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());

useEffect(() => {
  const updateActiveSessions = async () => {
    const workingDir = useSessionStore.getState().workingDir;
    if (!workingDir) return;
    
    try {
      const res = await fetch(`/api/sessions/active?workingDir=${encodeURIComponent(workingDir)}`);
      const data = await res.json();
      const active = new Set(data.activeSessions
        .filter((s: any) => s.isActive)
        .map((s: any) => s.sessionFile));
      setActiveSessions(active);
    } catch (error) {
      console.error("Failed to fetch active sessions:", error);
    }
  };
  
  updateActiveSessions();
  const interval = setInterval(updateActiveSessions, 5000);
  return () => clearInterval(interval);
}, []);

// 在渲染中添加状态指示器
{sessions.map(session => (
  <div key={session.id} className={...}>
    <span className={styles.sessionName}>
      {session.name}
      {activeSessions.has(session.id) && (
        <span className={styles.activeDot}>●</span>
      )}
    </span>
  </div>
))}
```

#### 4.2 添加CSS样式
```css
.activeDot {
  color: #4CAF50;
  font-size: 12px;
  margin-left: 4px;
}
```

## 方案优势

1. **极简修改**：总计不到50行代码修改
2. **向后兼容**：现有功能完全不受影响
3. **无状态复杂性**：不引入复杂的状态管理
4. **易于测试**：修改点少，容易验证

## 工作原理

1. **多个会话共存**：同一`workingDir`下可注册多个`sessionKey`
2. **会话切换**：前端发送`load_session`消息 → 后端`getOrCreateSession`获取目标会话 → 更新WebSocket关联
3. **状态显示**：前端定期查询`/api/sessions/active` → 显示活跃会话状态
4. **独立运行**：每个会话有独立的`PiAgentSession`和`AgentSession`实例

## 测试验证

### 测试命令
```bash
# 1. 启动开发环境
bash scripts/start-tmux-dev.sh

# 2. 测试API
curl "http://localhost:3000/api/sessions/active?workingDir=/root"

# 3. 浏览器测试
# - 创建会话A，发送消息
# - 创建会话B，发送不同消息
# - 切换回会话A，验证历史
# - 观察侧边栏活跃状态
```

### 预期结果
- API返回：`{"activeSessions":[{"sessionFile":"...","isActive":true},...]}`
- 侧边栏显示绿点表示活跃会话
- 会话切换后消息历史正确显示

## 风险控制

### 已知问题
1. **内存泄漏**：多个会话长期运行可能占用内存
   - **缓解**：后续可添加会话超时清理（非本次任务）

2. **映射错误**：修改映射关系可能导致客户端找不到会话
   - **缓解**：添加详细日志，便于调试

### 回滚方案
```bash
# 恢复修改的文件
git checkout src/server/features/chat/agent-session/session-manager.ts
git checkout src/server/features/chat/ws-handlers/session-handlers.ts
git checkout src/server/features/chat/controllers/session.controller.ts
git checkout src/server/features/chat/http-routes.ts
```

## 后续扩展（非本次任务）

1. **会话命名**：允许用户自定义会话名称
2. **会话收藏**：标记常用会话
3. **自动清理**：非活跃会话超时关闭
4. **会话导入/导出**：备份和恢复会话

---

## 开始实施

建议按顺序实施：

1. **第一步**：修改 `session-manager.ts`（核心）
2. **第二步**：修改 `session-handlers.ts`
3. **第三步**：添加HTTP API
4. **第四步**：测试后端功能
5. **第五步**：修改前端显示（可选）

每个步骤后运行：
```bash
npm run check  # 确保无语法错误
npm test       # 运行现有测试
```

## 注意事项

1. **日志级别**：修改后增加日志输出，便于调试
2. **浏览器兼容**：前端修改使用标准API，无兼容性问题
3. **性能影响**：HTTP轮询间隔设为5秒，影响极小

此方案为最小可行修改，完全满足需求且风险可控。